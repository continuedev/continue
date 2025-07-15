import { ChatMessage, PromptLog, TextMessagePart } from "../..";
import { normalizeToMessageParts } from "../../util/messageContent";
import { detectToolCallStart } from "./detectToolCallStart";
import { generateOpenAIToolCallId } from "./openAiToolCallId";
import {
  DEFAULT_TOOL_CALL_PARSE_STATE,
  handleToolCallBuffer,
  ToolCallParseState,
} from "./parseSystemToolCall";
import { splitAtCodeblocksAndNewLines } from "./xmlToolUtils";

/*
    Function to intercept tool calls in XML format from a chat message stream
    1. Skips non-assistant messages
    2. Skips xml that doesn't have root "tool_call" tag
    3. Intercepts text that contains a partial <tool_call> tag at the beginning, e.g. "<too" and simply adds to buffer
    4. Once confirmed in tool call (buffer starts with <tool_call>), performs partial XML parsing
    5. Successful partial parsing yields JSON tool call delta with previous partial parses removed
    6. Failed partial parsing just adds to buffer and continues
    7. Closes when closed </tool_call> tag is found
    8. TERMINATES AFTER THE FIRST TOOL CALL - TODO - REMOVE THIS FOR PARALLEL SUPPORT
*/
export async function* interceptSystemToolCalls(
  messageGenerator: AsyncGenerator<ChatMessage[], PromptLog | undefined>,
  abortController: AbortController,
): AsyncGenerator<ChatMessage[], PromptLog | undefined> {
  let inToolCall = false;
  let currentToolCallId: string | undefined = undefined;
  let buffer = "";

  let parseState: ToolCallParseState | undefined;

  while (true) {
    const result = await messageGenerator.next();
    if (result.done) {
      return result.value;
    } else {
      for await (const message of result.value) {
        if (abortController.signal.aborted || parseState?.done) {
          break;
        }
        // Skip non-assistant messages or messages with native tool calls
        if (message.role !== "assistant" || message.toolCalls) {
          yield [message];
          continue;
        }

        const parts = normalizeToMessageParts(message);

        // Image output cannot be combined with tools
        if (parts.find((part) => part.type === "imageUrl")) {
          yield [message];
          continue;
        }

        const chunks = (parts as TextMessagePart[])
          .map((part) => splitAtCodeblocksAndNewLines(part.text))
          .flat();

        for (const chunk of chunks) {
          buffer += chunk;
          debugger;
          if (!inToolCall) {
            const { isInPartialStart, isInToolCall, modifiedBuffer } =
              detectToolCallStart(buffer);

            if (isInPartialStart) {
              continue;
            }
            if (isInToolCall) {
              inToolCall = true;
              buffer = modifiedBuffer;
            }
          }

          if (inToolCall) {
            if (!currentToolCallId) {
              currentToolCallId = generateOpenAIToolCallId();
            }
            if (!parseState) {
              parseState = DEFAULT_TOOL_CALL_PARSE_STATE;
            }

            try {
              // Directly parse the accumulated buffer without storing a separate toolCallText
              const { delta, done: toolCallDone } = handleToolCallBuffer(
                buffer,
                currentToolCallId,
                parseState,
              );
              if (delta) {
                yield [
                  {
                    ...message,
                    content: "",
                    toolCalls: [delta],
                  },
                ];
              }

              if (toolCallDone) {
                inToolCall = false;
                currentToolCallId = undefined;
                parseState = undefined;
              }

              // Reset the buffer after successful parsing
              buffer = "";
            } catch (e) {
              console.error("Failed to parse system tool call", e);
              yield [
                {
                  ...message,
                  content: buffer,
                },
              ];
              buffer = "";
            }
          } else {
            // Yield normal assistant message
            yield [
              {
                ...message,
                content: buffer,
              },
            ];
            buffer = "";
          }
        }
      }
    }
  }
}
