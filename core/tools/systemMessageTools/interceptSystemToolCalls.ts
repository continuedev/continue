import { ChatMessage, PromptLog, TextMessagePart } from "../..";
import { normalizeToMessageParts } from "../../util/messageContent";
import { detectToolCallStart } from "./detectToolCallStart";
import { generateOpenAIToolCallId } from "./openAiToolCallId";
import {
  getInitialTooLCallParseState,
  handleToolCallBuffer,
  ToolCallParseState,
} from "./parseSystemToolCall";
import { splitAtCodeblocksAndNewLines } from "./systemToolUtils";

/*
    Function to intercept tool calls in markdown code blocks format from a chat message stream
    1. Skips non-assistant messages
    2. Intercepts text that looks like a tool call in a markdown code block format:
    ```tool
    TOOL_NAME: example_tool
    BEGIN_ARG: arg1
    value
    END_ARG
    ```
    3. Parses tool calls line by line and generates proper tool call deltas
    4. Once the tool call is complete, resets state for potential future tool calls
*/
export async function* interceptSystemToolCalls(
  messageGenerator: AsyncGenerator<ChatMessage[], PromptLog | undefined>,
  abortController: AbortController,
): AsyncGenerator<ChatMessage[], PromptLog | undefined> {
  let hasSeenToolCall = false;
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
              parseState = getInitialTooLCallParseState();
            }

            const delta = handleToolCallBuffer(
              buffer,
              currentToolCallId,
              parseState,
            );
            if (delta) {
              hasSeenToolCall = true;
              yield [
                {
                  ...message,
                  content: "",
                  toolCalls: [delta],
                },
              ];
            }

            if (parseState.done) {
              inToolCall = false;
              currentToolCallId = undefined;
              parseState = undefined;
            }
          } else {
            // Prevent content after tool calls for now
            if (hasSeenToolCall) {
              continue;
            }

            // Yield normal assistant message
            yield [
              {
                ...message,
                content: [{ type: "text", text: buffer }],
              },
            ];
          }
          buffer = "";
        }
      }
    }
  }
}
