import { Writable } from "stream";
import {
  AssistantChatMessage,
  ChatMessage,
  LLMInteractionCancel,
  LLMInteractionError,
  LLMInteractionItem,
  LLMInteractionStartChat,
  LLMInteractionStartComplete,
  LLMInteractionStartFim,
  LLMInteractionSuccess,
  ThinkingChatMessage,
  ToolCallDelta,
  UserChatMessage,
} from "..";
import { LLMLogger } from "./logger";

// Markers for different overlapping interactions.
const LOG_PREFIXES = [" ", "|", "&", "%", "#"];
// Wrap wide to avoid messing up code
const DEFAULT_WRAP_WIDTH = 100;

interface InteractionData {
  prefix: string;
  startItem: LLMInteractionItem;
  lastItem: LLMInteractionItem | null;
}

function formatTimestamp(timestamp: number) {
  const date = new Date(timestamp);

  const hours = date.getUTCHours().toString().padStart(2, "0");
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  const seconds = date.getUTCSeconds();
  const milliseconds = date.getUTCMilliseconds();

  // Format seconds with one decimal place
  const secondsFormatted = `${seconds}.${Math.floor(milliseconds / 100)}`;

  return `${hours}:${minutes}:${secondsFormatted.padStart(4, "0")}`;
}

/**
 * A class that formats LLM log output as a human-readable stream.
 * The general appearance of the output is something like:
 *
 *  01:23:45.6 [Chat]
 *             Options: {
 *               "maxTokens": 1000,
 *             }
 *             Role: system
 *             | You are a helpful assistant.
 *             Role: user
 *             | Who are you?
 *        +0.2 Role: assistant
 *             | How can I help you today?
 *        +0.3 | I can tell you about the weather or the stock mark
 *        +0.4 . et. [THIS LINE IS WRAPPED]
 * |01:23:46.1 [Complete]
 * |           Options: {
 * |             "maxTokens": 1000,
 * |           }
 * |           Prefix:
 * |           | COMPLETE THIS
 *        +0.6 Success
 *             PromptTokens: 50
 *             GeneratedTokens: 30
 * |      +0.2 Result:
 * |           | COMPLETION
 *
 * The lines with | are a second interaction that starts while the
 * first one is still in progress; every interaction starts with
 * an absolute timestamp, and relative timestamps are included for
 * separately received results in the same interaction.
 */
export class LLMLogFormatter {
  // Current active interactions
  private interactions: Record<string, InteractionData> = {};
  private lastItem: LLMInteractionItem | null = null;
  // Item that started the current line; we use this to determine
  // if the next line needs a timestamp.
  private lastLineStartItem: LLMInteractionItem | null = null;
  private openLine: boolean = false;
  private openLineChars: number = 0;
  private lastFreedPrefix: string | null = null;

  /**
   * Creates a new LLMLogWriter.
   * @param logger - The LLMLogger instance to listen to for log items
   * @param output - Stream to write formatted output to
   * @param wrapWidth - Maximum width of a line before wrapping
   */
  constructor(
    private logger: LLMLogger,
    private output: Writable,
    private wrapWidth: number = DEFAULT_WRAP_WIDTH,
  ) {
    this.logger.onLogItem((item) => {
      this.logItem(item);
    });
  }

  private getInteractionData(item: LLMInteractionItem) {
    let interaction = this.interactions[item.interactionId];
    if (interaction !== undefined) {
      return interaction;
    }

    let usedPrefixes = Object.values(this.interactions).map(
      (interaction) => interaction.prefix,
    );

    // Select a prefix that is not currently in use, and is
    // also not the last retired prefix - but with the
    // exception that we can reuse the empty prefix " "
    // immediately - this isn't confusing.
    let i = 0;
    let prefix;
    while (true) {
      const candidate = i < LOG_PREFIXES.length ? LOG_PREFIXES[i] : `X`;
      if (
        !usedPrefixes.includes(candidate) &&
        (candidate === " " || candidate !== this.lastFreedPrefix)
      ) {
        prefix = candidate;
        break;
      }
      i++;
    }

    this.interactions[item.interactionId] = {
      prefix,
      startItem: item,
      lastItem: null,
    };

    return this.interactions[item.interactionId];
  }

  private formatTimestamp(
    interaction: InteractionData,
    item: LLMInteractionItem,
  ) {
    if (item !== this.lastLineStartItem) {
      if (item === interaction.startItem) {
        return formatTimestamp(item.timestamp);
      } else {
        const delta = (item.timestamp - interaction.startItem.timestamp) / 1000;
        return ("+" + delta.toFixed(1)).padStart(10, " ");
      }
    } else {
      return "          ";
    }
  }

  // the implementation behind logLines and logMessageText
  private logFragment(
    item: LLMInteractionItem,
    fragment: string,
    startAt: number,
    marker: string = "",
    joinBefore: boolean = false,
    joinAfter: boolean = false,
    wrap: boolean = false,
  ) {
    const interaction = this.getInteractionData(item);

    if (
      this.openLine &&
      (!joinBefore || item.interactionId !== this.lastItem?.interactionId)
    ) {
      this.openLine = false;
      this.openLineChars = 0;
      this.output.write("\n");
    }

    let continueAt = null;
    if (
      wrap &&
      fragment.length - startAt > this.wrapWidth - this.openLineChars
    ) {
      continueAt = startAt + this.wrapWidth - this.openLineChars;

      // Look for a better line-breaking point at whitespace
      const searchBackwardLimit = Math.max(startAt, continueAt - 20); // Don't look back too far
      for (let i = continueAt; i > searchBackwardLimit; i--) {
        if (/\s/.test(fragment.charAt(i))) {
          continueAt = i + 1; // Break after the whitespace
          break;
        }
      }

      // When there's whitespace immediately after the wrap width,
      // the above will result in breaking *after* that, so we exceed
      // the wrap width. The trimEnd() avoids that.
      fragment = fragment.substring(startAt, continueAt).trimEnd();
      joinAfter = false;
    } else if (startAt > 0) {
      fragment = fragment.substring(startAt);
    }

    if (!this.openLine || !this.openLine) {
      let timestamp = this.formatTimestamp(interaction, item);
      this.output.write(`${interaction.prefix}${timestamp} ${marker}`);
      this.lastLineStartItem = item;
    }

    this.output.write(fragment);
    this.openLine = joinAfter;
    this.lastItem = item;
    if (!this.openLine) {
      this.output.write("\n");
      this.openLineChars = 0;
    } else {
      this.openLineChars += fragment.length;
    }

    return continueAt;
  }

  // Use for everything but text content; a newline is
  // implicitly added at the end of content
  private logLines(
    item: LLMInteractionItem,
    content: string,
    marker: string = "",
  ) {
    for (const line of content.split("\n")) {
      this.logFragment(item, line, 0, marker);
    }
  }

  // This logs text context - as compared to logLines:
  //  - No newline is appended to the end of content
  //  - consecutive calls to logMessageText for the same interaction
  //    will join onto a single line
  //  - It will wrap text at the wrap width
  private logMessageText(item: LLMInteractionItem, content: string) {
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      let startAt: number | null = 0;
      let marker = "| ";
      while (startAt !== null) {
        // When wrapping, the next start position is turned;
        // null means we've written everything
        startAt = this.logFragment(
          item,
          lines[i],
          startAt,
          marker,
          true,
          i === lines.length - 1,
          true,
        );
        marker = ". ";
      }
    }
  }

  private logToolcalls(item: LLMInteractionItem, toolsCalls: ToolCallDelta[]) {
    for (const toolCall of toolsCalls) {
      this.logLines(
        item,
        `Tool call: ${JSON.stringify(toolCall, undefined, 2)}`,
      );
    }
  }

  private logMessageContent(
    item: LLMInteractionItem,
    message: AssistantChatMessage | UserChatMessage | ThinkingChatMessage,
  ) {
    if (typeof message.content === "string") {
      this.logMessageText(item, message.content);
    } else {
      for (const part of message.content) {
        if (part.type === "text") {
          this.logMessageText(item, part.text);
        } else {
          this.logLines(item, `Image: ${part.imageUrl.url}`);
        }
      }
    }
  }

  private logMessage(
    item: LLMInteractionItem,
    message: ChatMessage,
    forceRole: boolean = false,
  ) {
    let showRole = true;
    if (
      !forceRole &&
      (message.role === "assistant" || message.role === "thinking")
    ) {
      const interaction = this.getInteractionData(item);
      const lastMessage =
        interaction.lastItem?.kind === "message"
          ? interaction.lastItem.message
          : null;
      if (message.role === lastMessage?.role) {
        showRole = false;
      }
    }

    if (showRole) {
      this.logLines(item, "Role: " + message.role);
    }

    switch (message.role) {
      case "assistant":
        if (message.toolCalls) {
          this.logToolcalls(item, message.toolCalls);
        }
        this.logMessageContent(item, message);
        break;
      case "thinking":
        if (message.toolCalls) {
          this.logToolcalls(item, message.toolCalls);
        }
        this.logMessageContent(item, message);
        if (message.redactedThinking) {
          this.logLines(item, `Redacted Thinking: ${message.redactedThinking}`);
        }
        if (message.signature) {
          this.logLines(item, `Signature: ${message.signature}`);
        }
        break;
      case "user":
        this.logMessageContent(item, message);
        break;
      case "system":
        this.logMessageText(item, message.content);
        break;
      case "tool":
        this.logLines(item, `Tool Call ID: ${message.toolCallId}`);
        this.logMessageText(item, message.content);
        break;
    }
  }

  private logTokens(
    item: LLMInteractionSuccess | LLMInteractionError | LLMInteractionCancel,
  ) {
    this.logLines(item, `Prompt Tokens: ${item.promptTokens}`);
    this.logLines(item, `Generated Tokens: ${item.generatedTokens}`);
    if (item.thinkingTokens > 0) {
      this.logLines(item, `Thinking Tokens: ${item.thinkingTokens}`);
    }
  }

  private logOptions(
    item:
      | LLMInteractionStartChat
      | LLMInteractionStartComplete
      | LLMInteractionStartFim,
  ) {
    this.logLines(
      item,
      "Options: " + JSON.stringify(item.options, undefined, 2),
    );
  }

  private logItem(item: LLMInteractionItem) {
    const interaction = this.getInteractionData(item);

    switch (item.kind) {
      case "startChat":
        this.logLines(item, "[Chat]");
        this.logOptions(item);
        let lastMessage = null;
        for (let message of item.messages) {
          this.logMessage(item, message, true);
        }
        break;
      case "startComplete":
        this.logLines(item, "[Complete]");
        this.logOptions(item);
        this.logLines(item, "Prompt:");
        this.logLines(item, item.prompt, "| ");
        break;
      case "startFim":
        this.logLines(item, "[Fim]");
        this.logOptions(item);
        this.logLines(item, "Prefix:");
        this.logLines(item, item.prefix, "| ");
        this.logLines(item, "Suffix:");
        this.logLines(item, item.suffix, "| ");
        break;
      case "chunk":
        if (interaction.lastItem?.kind !== "chunk") {
          this.logLines(item, "Result:");
        }
        this.logMessageText(item, item.chunk);
        break;
      case "message":
        this.logMessage(item, item.message);
        break;
      case "cancel":
        this.logLines(item, "Cancelled");
        this.logTokens(item);
        break;
      case "error":
        this.logLines(item, "Error");
        this.logTokens(item);
        break;
      case "success":
        this.logLines(item, "Success");
        this.logTokens(item);
        break;
    }

    if (
      item.kind === "cancel" ||
      item.kind === "error" ||
      item.kind === "success"
    ) {
      if (interaction.prefix !== " ") {
        this.lastFreedPrefix = interaction.prefix;
      }
      delete this.interactions[item.interactionId];
    } else {
      interaction.lastItem = item;
    }
  }
}
