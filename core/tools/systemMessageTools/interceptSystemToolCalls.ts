import { ChatMessage, PromptLog, TextMessagePart } from "../..";
import { normalizeToMessageParts } from "../../util/messageContent";
import { detectToolCallStart } from "./detectToolCallStart";
import { createDelta, splitAtCodeblocksAndNewLines } from "./systemToolUtils";
import {
  getInitialToolCallParseState,
  SystemMessageToolsFramework,
  ToolCallParseState,
} from "./types";

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
  systemToolFramework: SystemMessageToolsFramework,
): AsyncGenerator<ChatMessage[], PromptLog | undefined> {
  let buffer = "";
  let parseState: ToolCallParseState | undefined;

  while (true) {
    const result = await messageGenerator.next();
    if (result.done) {
      // Case: non-standard tool termination causes hanging args
      if (parseState && !parseState.done && parseState.processedArgNames.size) {
        yield [
          {
            role: "assistant",
            content: "",
            toolCalls: [createDelta("", "}", parseState.toolCallId)],
          },
        ];
      }

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
          if (!parseState) {
            const { isInPartialStart, isInToolCall, modifiedBuffer } =
              detectToolCallStart(buffer, systemToolFramework);

            if (isInPartialStart) {
              continue;
            }
            if (isInToolCall) {
              parseState = getInitialToolCallParseState();
              buffer = modifiedBuffer;
            }
          }

          if (parseState && !parseState.done) {
            const delta = systemToolFramework.handleToolCallBuffer(
              buffer,
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
          } else {
            // Prevent content after tool calls for now
            if (parseState) {
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
