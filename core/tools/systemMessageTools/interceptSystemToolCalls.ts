import {
  AssistantChatMessage,
  ChatMessage,
  PromptLog,
  TextMessagePart,
} from "../..";
import { normalizeToMessageParts } from "../../util/messageContent";
import { detectToolCallStart } from "./detectToolCallStart";
import { createDelta, splitAtCodeblocksAndNewLines } from "./systemToolUtils";
import {
  getInitialToolCallParseState,
  SystemMessageToolsFramework,
  ToolCallParseState,
} from "./types";

/**
 * What a streamed assistant message carries besides its text: the token
 * counts (on the final chunk), the account that answered (a model with
 * routes) and a local server's prompt progress. They belong to the message,
 * not to its text, so they are passed on once, after the text, even when the
 * message has no text: the final usage chunk and progress updates have none.
 */
function messageMeta(message: ChatMessage): ChatMessage | undefined {
  const { usage, route, routeProvider, routeModel, promptProgress } =
    message as ChatMessage & {
      usage?: unknown;
      route?: string;
      routeProvider?: string;
      routeModel?: string;
      promptProgress?: unknown;
    };
  if (!usage && !promptProgress) return undefined;
  return {
    role: "assistant",
    content: "",
    ...(usage ? { usage } : {}),
    ...(route ? { route } : {}),
    ...(routeProvider ? { routeProvider } : {}),
    ...(routeModel ? { routeModel } : {}),
    ...(promptProgress ? { promptProgress } : {}),
  } as ChatMessage;
}

/** The message without the fields messageMeta passes on separately. */
function withoutMeta(message: AssistantChatMessage): AssistantChatMessage {
  const {
    usage: _usage,
    route: _route,
    routeProvider: _routeProvider,
    routeModel: _routeModel,
    promptProgress: _promptProgress,
    ...rest
  } = message;
  return rest;
}

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
        if (abortController.signal.aborted) {
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

        const meta = messageMeta(message);
        const text = withoutMeta(message);
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
                  ...text,
                  content: "",
                  toolCalls: [delta],
                },
              ];
            }
            // Completed tool calls should not terminate parsing for subsequent
            // chunks/messages; reset state so normal content (or another tool
            // call) can be handled.
            if (parseState.done) {
              parseState = undefined;
            }
          } else {
            // Yield normal assistant message
            yield [
              {
                ...text,
                content: [{ type: "text", text: buffer }],
              },
            ];
          }
          buffer = "";
        }

        if (meta) yield [meta];
      }
    }
  }
}
