/**
 * Context window analysis: token breakdown by role/tool and duplicate-read
 * detection across a conversation history.
 *
 * Ported from Marcel (src/utils/contextAnalysis.ts), adapted to Continue's
 * ChatMessage type system.
 *
 * Useful for:
 *  - Showing the user where their context window budget is going.
 *  - Identifying files that were read multiple times (wasted tokens).
 *  - Deciding when to compact or summarise.
 */

import {
  AssistantChatMessage,
  ChatMessage,
  ToolResultChatMessage,
} from "..";
import { countTokens } from "../llm/countTokens";

export type ContextStats = {
  /** Token cost per tool name (assistant tool call requests). */
  toolRequests: Map<string, number>;
  /** Token cost per tool name (tool result messages). */
  toolResults: Map<string, number>;
  /** Tokens in plain user messages. */
  userMessages: number;
  /** Tokens in assistant text messages (excluding tool calls). */
  assistantMessages: number;
  /** Tokens in system messages. */
  systemMessages: number;
  /**
   * Files that were read more than once, with the number of duplicate reads
   * and an estimate of the wasted tokens (all reads after the first).
   */
  duplicateFileReads: Map<string, { count: number; wastedTokens: number }>;
  /** Grand total across all message types. */
  total: number;
};

function roughTokens(value: unknown): number {
  return countTokens(typeof value === "string" ? value : JSON.stringify(value));
}

/**
 * Analyse `messages` and return a `ContextStats` summary.
 *
 * Pass an LLM-bound `countFn` when you have access to a model-specific
 * encoder (e.g. `llm.countTokens`). Falls back to the tiktoken-based
 * `countTokens` from `core/llm/countTokens`.
 */
export function analyzeContext(
  messages: ChatMessage[],
  countFn: (text: string) => number = countTokens,
): ContextStats {
  const stats: ContextStats = {
    toolRequests: new Map(),
    toolResults: new Map(),
    userMessages: 0,
    assistantMessages: 0,
    systemMessages: 0,
    duplicateFileReads: new Map(),
    total: 0,
  };

  // toolCallId → tool name (to correlate results back to the requesting tool)
  const callIdToTool = new Map<string, string>();
  // toolCallId → file path (for read_file duplicate detection)
  const callIdToFilePath = new Map<string, string>();
  // file path → { count, totalTokens }
  const fileReadStats = new Map<string, { count: number; totalTokens: number }>();

  function add(bucket: "userMessages" | "assistantMessages" | "systemMessages", tokens: number) {
    stats[bucket] += tokens;
    stats.total += tokens;
  }

  function addTool(map: Map<string, number>, name: string, tokens: number) {
    map.set(name, (map.get(name) ?? 0) + tokens);
    stats.total += tokens;
  }

  for (const msg of messages) {
    switch (msg.role) {
      case "system": {
        const t = countFn(msg.content);
        add("systemMessages", t);
        break;
      }

      case "user": {
        const text =
          typeof msg.content === "string"
            ? msg.content
            : msg.content
                .map((p) => (p.type === "text" ? p.text : "[image]"))
                .join(" ");
        const t = countFn(text);
        add("userMessages", t);
        break;
      }

      case "assistant": {
        const assistantMsg = msg as AssistantChatMessage;
        // Text content
        const textContent =
          typeof assistantMsg.content === "string"
            ? assistantMsg.content
            : assistantMsg.content
                .map((p) => (p.type === "text" ? p.text : ""))
                .join("");
        if (textContent.trim()) {
          add("assistantMessages", countFn(textContent));
        }

        // Tool call requests
        if (assistantMsg.toolCalls) {
          for (const tc of assistantMsg.toolCalls) {
            const name = tc.function?.name ?? "unknown";
            const argsText = tc.function?.arguments ?? "";
            const t = countFn(name + argsText);
            addTool(stats.toolRequests, name, t);

            if (tc.id) {
              callIdToTool.set(tc.id, name);

              // Track read_file paths for duplicate detection
              if (
                name === "read_file" ||
                name === "read_existing_file" ||
                name === "read_currently_open_file"
              ) {
                try {
                  const parsed = JSON.parse(argsText);
                  const filePath: string | undefined =
                    parsed?.filepath ?? parsed?.file_path ?? parsed?.path;
                  if (filePath) {
                    callIdToFilePath.set(tc.id, filePath);
                  }
                } catch {
                  // non-JSON args — skip
                }
              }
            }
          }
        }
        break;
      }

      case "tool": {
        const toolMsg = msg as ToolResultChatMessage;
        const name = callIdToTool.get(toolMsg.toolCallId) ?? "unknown";
        const t = countFn(toolMsg.content);
        addTool(stats.toolResults, name, t);

        // Accumulate file-read token stats for duplicate detection
        const filePath = callIdToFilePath.get(toolMsg.toolCallId);
        if (filePath) {
          const prev = fileReadStats.get(filePath) ?? { count: 0, totalTokens: 0 };
          fileReadStats.set(filePath, {
            count: prev.count + 1,
            totalTokens: prev.totalTokens + t,
          });
        }
        break;
      }

      case "thinking": {
        // Count thinking tokens toward assistant budget
        const text =
          typeof msg.content === "string"
            ? msg.content
            : msg.content.map((p) => (p.type === "text" ? p.text : "")).join("");
        if (text.trim()) {
          add("assistantMessages", countFn(text));
        }
        break;
      }
    }
  }

  // Duplicate file read detection
  for (const [filePath, data] of fileReadStats) {
    if (data.count > 1) {
      const avgTokensPerRead = Math.floor(data.totalTokens / data.count);
      stats.duplicateFileReads.set(filePath, {
        count: data.count,
        wastedTokens: avgTokensPerRead * (data.count - 1),
      });
    }
  }

  return stats;
}

/**
 * Format a ContextStats summary as a human-readable report string.
 */
export function formatContextStats(stats: ContextStats): string {
  const lines: string[] = [];

  lines.push(`Total tokens: ${stats.total.toLocaleString()}`);
  lines.push(`  User messages:      ${stats.userMessages.toLocaleString()}`);
  lines.push(`  Assistant messages: ${stats.assistantMessages.toLocaleString()}`);
  lines.push(`  System messages:    ${stats.systemMessages.toLocaleString()}`);

  if (stats.toolRequests.size > 0) {
    lines.push("\nTool requests:");
    for (const [name, tokens] of [...stats.toolRequests.entries()].sort(
      (a, b) => b[1] - a[1],
    )) {
      lines.push(`  ${name}: ${tokens.toLocaleString()}`);
    }
  }

  if (stats.toolResults.size > 0) {
    lines.push("\nTool results:");
    for (const [name, tokens] of [...stats.toolResults.entries()].sort(
      (a, b) => b[1] - a[1],
    )) {
      lines.push(`  ${name}: ${tokens.toLocaleString()}`);
    }
  }

  if (stats.duplicateFileReads.size > 0) {
    lines.push("\nDuplicate file reads (wasted tokens):");
    for (const [filePath, data] of [...stats.duplicateFileReads.entries()].sort(
      (a, b) => b[1].wastedTokens - a[1].wastedTokens,
    )) {
      lines.push(
        `  ${filePath}: read ${data.count}x, ~${data.wastedTokens.toLocaleString()} wasted tokens`,
      );
    }
  }

  return lines.join("\n");
}
