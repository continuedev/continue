import { ChatMessage, PromptLog, TextMessagePart } from "../..";
import { normalizeToMessageParts } from "../../util/messageContent";
import { detectToolCallStart } from "./detectToolCallStart";
import { generateOpenAIToolCallId } from "./openAiToolCallId";
import { parseToolCallText } from "./parseSystemToolCall";
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
  let toolCallText = "";
  let currentToolCallId: string | undefined = undefined;
  let inToolCall = false;

  let done = false;
  let buffer = "";

  while (true) {
    if (abortController.signal.aborted) {
      done = true;
    }

    const result = await messageGenerator.next();
    if (result.done) {
      return result.value;
    } else {
      for await (const message of result.value) {
        if (done) {
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

            toolCallText += buffer;
            try {
              const { delta, done: toolCallDone } = parseToolCallText(
                toolCallText,
                currentToolCallId,
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
                done = true;
              }
            } catch (e) {
              console.error("Failed to parse system tool call");
              yield [
                {
                  ...message,
                  content: toolCallText,
                },
              ];
            }
          } else {
            // Yield normal assistant message
            yield [
              {
                ...message,
                content: buffer,
              },
            ];
          }
          buffer = "";
        }
      }
    }
  }
}
