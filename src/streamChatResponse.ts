import { CompletionOptions, ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import * as dotenv from "dotenv";
import type {
  ChatCompletionCreateParamsStreaming,
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
} from "openai/resources.mjs";
import { parseArgs } from "./args.js";
import { MCPService } from "./mcp.js";
import telemetryService from "./telemetry/telemetryService.js";
import { calculateTokenCost } from "./telemetry/utils.js";
import { executeToolCall } from "./tools.js";
import { BUILTIN_TOOLS } from "./tools/index.js";
import {
  chatCompletionStreamWithBackoff,
  withExponentialBackoff,
} from "./util/exponentialBackoff.js";
import logger from "./util/logger.js";

dotenv.config();

export function getAllTools() {
  const args = parseArgs();

  // If no-tools mode is enabled, return empty array
  if (args.noTools) {
    return [];
  }

  const allTools: ChatCompletionTool[] = BUILTIN_TOOLS.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object",
        properties: Object.fromEntries(
          Object.entries(tool.parameters).map(([key, param]) => [
            key,
            { type: param.type, description: param.description },
          ])
        ),
        required: Object.entries(tool.parameters)
          .filter(([_, param]) => param.required)
          .map(([key, _]) => key),
      },
    },
  }));

  // Add MCP tools if not in no-tools mode
  const mcpTools = MCPService.getInstance()?.getTools() ?? [];
  allTools.push(
    ...mcpTools.map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }))
  );

  return allTools;
}

export interface StreamCallbacks {
  onContent?: (content: string) => void;
  onContentComplete?: (content: string) => void;
  onToolStart?: (toolName: string, toolArgs?: any) => void;
  onToolResult?: (result: string, toolName: string) => void;
  onToolError?: (error: string, toolName?: string) => void;
}

interface ToolCall {
  id: string;
  name: string;
  arguments: any;
  argumentsStr: string;
  startNotified: boolean;
}

function getDefaultCompletionOptions(
  opts?: CompletionOptions
): Partial<ChatCompletionCreateParamsStreaming> {
  if (!opts) return {};
  return {
    max_tokens: opts.maxTokens,
    temperature: opts.temperature,
    frequency_penalty: opts.frequencyPenalty,
    presence_penalty: opts.presencePenalty,
    top_p: opts.topP,
  };
}

// Process a single streaming response and return whether we need to continue
async function processStreamingResponse(
  chatHistory: ChatCompletionMessageParam[],
  model: ModelConfig,
  llmApi: BaseLlmApi,
  abortController: AbortController,
  callbacks?: StreamCallbacks,
  isHeadless?: boolean,
  tools?: ChatCompletionTool[]
): Promise<{
  content: string;
  finalContent: string; // Added field for final content only
  toolCalls: ToolCall[];
  shouldContinue: boolean;
}> {
  const requestStartTime = Date.now();

  const streamFactory = async () => {
    logger.debug("Creating chat completion stream", {
      model,
      messageCount: chatHistory.length,
      toolCount: tools?.length || 0,
    });
    return await chatCompletionStreamWithBackoff(
      llmApi,
      {
        model: model.model,
        messages: chatHistory,
        stream: true,
        tools,
        ...getDefaultCompletionOptions(model.defaultCompletionOptions),
      },
      abortController.signal
    );
  };

  let aiResponse = "";
  let finalContent = "";
  const toolCallsMap = new Map<string, ToolCall>();
  let firstTokenTime: number | null = null;
  let inputTokens = 0;
  let outputTokens = 0;
  let hasToolCalls = false;

  try {
    const streamWithBackoff = withExponentialBackoff(
      streamFactory,
      abortController.signal
    );

    let chunkCount = 0;
    for await (const chunk of streamWithBackoff) {
      chunkCount++;

      logger.debug("Received chunk", { chunkCount, chunk });

      // Track first token time
      if (
        firstTokenTime === null &&
        (chunk.choices[0].delta.content || chunk.choices[0].delta.tool_calls)
      ) {
        firstTokenTime = Date.now();
        telemetryService.recordResponseTime(
          firstTokenTime - requestStartTime,
          model.model,
          "time_to_first_token",
          (tools?.length || 0) > 0
        );
      }

      // Track token usage if available
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens || 0;
        outputTokens = chunk.usage.completion_tokens || 0;
      }

      // Check if we should abort
      if (abortController?.signal.aborted) {
        logger.debug("Stream aborted");
        break;
      }

      // Safety check: ensure chunk has the expected structure
      if (!chunk.choices || !chunk.choices[0]) {
        logger.warn("Malformed chunk received - missing choices", { chunk });
        continue;
      }

      const choice = chunk.choices[0];
      if (!choice.delta) {
        logger.warn("Malformed chunk received - missing delta", { chunk });
        continue;
      }

      // Handle content streaming
      if (choice.delta.content) {
        const content = choice.delta.content;
        aiResponse += content;

        // Call the onContent callback if provided
        if (callbacks?.onContent) {
          callbacks.onContent(content);
        } else if (!isHeadless) {
          // Print content directly if no callback
          process.stdout.write(content);
        }
      }

      // Handle tool calls
      if (choice.delta.tool_calls) {
        hasToolCalls = true;
        for (const toolCallDelta of choice.delta.tool_calls) {
          // Get or create tool call
          if (toolCallDelta.id) {
            if (!toolCallsMap.has(toolCallDelta.id)) {
              toolCallsMap.set(toolCallDelta.id, {
                id: toolCallDelta.id,
                name: "",
                arguments: null,
                argumentsStr: "",
                startNotified: false,
              });
            }
          }

          const toolCall = toolCallsMap.get(toolCallDelta.id || "");
          if (!toolCall) continue;

          // Update name
          if (toolCallDelta.function?.name) {
            toolCall.name = toolCallDelta.function.name;
          }

          // Accumulate arguments
          if (toolCallDelta.function?.arguments) {
            toolCall.argumentsStr += toolCallDelta.function.arguments;

            // Try to parse when we might have complete JSON
            try {
              toolCall.arguments = JSON.parse(toolCall.argumentsStr);

              // Notify on first successful parse
              if (!toolCall.startNotified && toolCall.name) {
                toolCall.startNotified = true;
                if (callbacks?.onToolStart) {
                  callbacks.onToolStart(toolCall.name, toolCall.arguments);
                }
              }
            } catch (e) {
              // JSON not complete yet, continue
            }
          }
        }
      }
    }

    const responseEndTime = Date.now();
    const totalDuration = responseEndTime - requestStartTime;

    // Record API request metrics
    const cost = calculateTokenCost(inputTokens, outputTokens, model.model);

    telemetryService.recordTokenUsage(inputTokens, "input", model.model);
    telemetryService.recordTokenUsage(outputTokens, "output", model.model);
    telemetryService.recordCost(cost, model.model);

    telemetryService.recordResponseTime(
      totalDuration,
      model.model,
      "total_response_time",
      (tools?.length || 0) > 0
    );

    // Log API request event
    telemetryService.logApiRequest(
      model.model,
      totalDuration,
      true, // success
      undefined, // no error
      inputTokens,
      outputTokens,
      cost
    );

    logger.debug("Stream complete", {
      chunkCount,
      responseLength: aiResponse.length,
      toolCallsCount: toolCallsMap.size,
      inputTokens,
      outputTokens,
      cost,
      duration: totalDuration,
    });
  } catch (error: any) {
    const errorDuration = Date.now() - requestStartTime;

    // Log failed API request
    telemetryService.logApiRequest(
      model.model,
      errorDuration,
      false, // failed
      error.message || String(error)
    );

    if (error.name === "AbortError" || abortController?.signal.aborted) {
      logger.debug("Stream aborted by user");
      return {
        content: aiResponse,
        finalContent: aiResponse,
        toolCalls: [],
        shouldContinue: false,
      };
    }
    throw error;
  }

  const toolCalls = Array.from(toolCallsMap.values());

  // Validate tool calls have complete arguments
  const validToolCalls = toolCalls.filter((tc) => {
    if (!tc.arguments || !tc.name) {
      logger.error("Incomplete tool call", {
        id: tc.id,
        name: tc.name,
        hasArguments: !!tc.arguments,
        argumentsStr: tc.argumentsStr,
      });
      return false;
    }
    return true;
  });

  // Set finalContent based on whether this was a tool call or not
  // For headless mode: if there's a tool call, we only want to show final text content
  // If it's the first response (no tool calls), we save the final content
  finalContent = hasToolCalls ? "" : aiResponse;

  return {
    content: aiResponse,
    finalContent: finalContent,
    toolCalls: validToolCalls,
    shouldContinue: validToolCalls.length > 0,
  };
}

// Main function that handles the conversation loop
export async function streamChatResponse(
  chatHistory: ChatCompletionMessageParam[],
  model: ModelConfig,
  llmApi: BaseLlmApi,
  abortController: AbortController,
  callbacks?: StreamCallbacks
) {
  logger.debug("streamChatResponse called", {
    model,
    historyLength: chatHistory.length,
    hasCallbacks: !!callbacks,
  });

  const args = parseArgs();
  const isHeadless = args.isHeadless;
  const tools = getAllTools();

  logger.debug("Tools prepared", {
    toolCount: tools.length,
    toolNames: tools.map((t) => t.function.name),
  });

  let fullResponse = "";
  let finalResponse = "";

  while (true) {
    logger.debug("Starting conversation iteration");

    // Get response from LLM
    const { content, finalContent, toolCalls, shouldContinue } =
      await processStreamingResponse(
        chatHistory,
        model,
        llmApi,
        abortController,
        callbacks,
        isHeadless,
        tools
      );

    fullResponse += content;

    // In headless mode, we only want to collect the final content after all tool calls
    if (!shouldContinue) {
      // This is the final message, so it's the content we want to show
      finalResponse = content;
    } else if (isHeadless && content) {
      // In headless mode with tool calls, we still want to show any text content
      // since we won't be making follow-up requests
      finalResponse = content;
    }

    // Add newline after content if needed
    if (!callbacks?.onContent && !isHeadless && content) {
      logger.info("");
    }

    // Notify content complete
    if (content && callbacks?.onContentComplete) {
      callbacks.onContentComplete(content);
    }

    // Add assistant message to history
    if (toolCalls.length > 0) {
      const toolCallsForHistory: ChatCompletionMessageToolCall[] =
        toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        }));

      chatHistory.push({
        role: "assistant",
        content: content || null,
        tool_calls: toolCallsForHistory,
      });

      // Execute tool calls
      for (const toolCall of toolCalls) {
        try {
          logger.debug("Executing tool", {
            name: toolCall.name,
            arguments: toolCall.arguments,
          });

          const toolResult = await executeToolCall({
            name: toolCall.name,
            arguments: toolCall.arguments,
          });

          chatHistory.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: toolResult,
          });

          if (callbacks?.onToolResult) {
            callbacks.onToolResult(toolResult, toolCall.name);
          }
        } catch (error) {
          const errorMessage = `Error executing tool ${toolCall.name}: ${
            error instanceof Error ? error.message : String(error)
          }`;

          logger.error("Tool execution failed", {
            name: toolCall.name,
            error: errorMessage,
          });

          chatHistory.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: errorMessage,
          });

          if (callbacks?.onToolError) {
            callbacks.onToolError(errorMessage, toolCall.name);
          }
        }
      }
    } else if (content) {
      // Just content, no tools
      chatHistory.push({ role: "assistant", content });
    }

    // Check if we should continue
    if (!shouldContinue) {
      logger.debug("Conversation complete - no more tool calls");
      break;
    }
  }

  logger.debug("streamChatResponse complete", {
    totalResponseLength: fullResponse.length,
    totalMessages: chatHistory.length,
  });

  // For headless mode, we return only the final response
  // Otherwise, return the full response
  return isHeadless ? finalResponse : fullResponse;
}
