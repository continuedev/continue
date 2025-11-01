import { streamSse } from "@continuedev/fetch";
import { ChatCompletionChunk } from "openai/resources/index";
import { ChatCompletionCreateParamsStreaming } from "openai/resources/chat/completions";
import { OpenAIConfig } from "../types.js";
import { customFetch } from "../util.js";
import { OpenAIApi } from "./OpenAI.js";

export interface StakdConfig extends OpenAIConfig {}

export class StakdApi extends OpenAIApi {
  constructor(config: StakdConfig) {
    super({
      ...config,
      apiBase: "http://localhost:8080/v1/",
    });
  }

  /**
   * Override to handle Stakd's custom reasoning field.
   * The reasoning field contains tool call JSON that needs to be:
   * 1. Displayed in the thinking accordion
   * 2. Parsed to extract tool calls
   */
  async *chatCompletionStream(
    body: ChatCompletionCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk> {
    const response = await customFetch(this.config.requestOptions)(
      new URL("chat/completions", this.apiBase),
      {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(this.modifyChatBody(body)),
        signal,
      },
    );

    let reasoningBuffer = "";
    let toolCallEmitted = false;
    let lastChunkWithUsage: ChatCompletionChunk | undefined;

    for await (const chunk of streamSse(response)) {
      const delta = chunk.choices?.[0]?.delta;
      const finishReason = chunk.choices?.[0]?.finish_reason;

      // Check for stream completion: finish_reason present with no more content
      if (finishReason && finishReason !== "null" && (!delta || (!delta.content && !delta.reasoning))) {
        // This is the final chunk signaling completion
        if (chunk.usage) {
          lastChunkWithUsage = chunk;
        }
        break;
      }

      if (!delta) {
        if (chunk.usage) {
          lastChunkWithUsage = chunk;
        } else {
          yield chunk;
        }
        continue;
      }

      // Handle reasoning field
      if (delta.reasoning) {
        reasoningBuffer += delta.reasoning;

        // Emit reasoning chunks for thinking accordion display
        yield chunk;

        // Try to parse complete tool call from accumulated reasoning
        if (!toolCallEmitted) {
          const toolCall = this.tryParseToolCall(reasoningBuffer);

          if (toolCall) {
            // Emit tool call separately in standard format
            yield {
              ...chunk,
              choices: [
                {
                  ...chunk.choices[0],
                  delta: {
                    role: "assistant",
                    tool_calls: [
                      {
                        index: 0,
                        id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                        type: "function",
                        function: {
                          name: toolCall.name,
                          arguments: JSON.stringify(toolCall.arguments),
                        },
                      },
                    ],
                  },
                },
              ],
            };
            toolCallEmitted = true;
          }
        }
        continue;
      }

      // Handle regular content
      if (chunk.usage) {
        lastChunkWithUsage = chunk;
      } else {
        yield chunk;
      }
    }

    // Emit usage chunk at the end if we have one
    if (lastChunkWithUsage) {
      yield lastChunkWithUsage;
    }
  }

  /**
   * Attempts to parse a complete tool call from the reasoning buffer.
   * Stakd sends tool calls in this JSON format:
   * {
   *   "TOOL_NAME": "fetch_url_content",
   *   "BEGIN_ARG": {"url": "https://..."},
   *   "END_ARG": {}
   * }
   */
  private tryParseToolCall(
    reasoningBuffer: string,
  ): { name: string; arguments: any } | null {
    try {
      // Try to extract JSON object from reasoning buffer
      const jsonMatch = reasoningBuffer.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);

      // Check if it has the expected Stakd tool call format
      if (parsed.TOOL_NAME && parsed.BEGIN_ARG) {
        return {
          name: parsed.TOOL_NAME,
          arguments: parsed.BEGIN_ARG,
        };
      }
    } catch (e) {
      // Not yet a complete/valid JSON, continue accumulating
    }
    return null;
  }
}

export default StakdApi;
