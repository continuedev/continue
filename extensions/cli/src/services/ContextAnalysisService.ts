/**
 * ContextAnalysisService — live context window analysis.
 *
 * Adapted from core/util/contextAnalysis.ts for the CLI's ChatHistoryItem
 * format and tokenizer utilities.
 *
 * Tracks:
 *  - Total tokens vs model context limit (usage %)
 *  - Token breakdown by role (system / user / assistant / tool)
 *  - Token cost per tool name (correlated via toolCallStates)
 *  - Duplicate file reads and estimated wasted tokens
 *  - Warning level: "ok" | "warning" (≥80%) | "critical" (≥95%)
 *
 * Updated after each LLM turn via update(). Results surfaced via
 * formatReport() for the /context slash command and getWarningLevel()
 * for in-stream warnings.
 */

import { ModelConfig } from "@yutoagentic/config-yaml";
import type { ChatHistoryItem } from "core/index.js";
import type { ChatCompletionTool } from "openai/resources/chat/completions.mjs";

import { logger } from "../util/logger.js";
import {
  countChatHistoryItemTokens,
  countToolDefinitionTokens,
  getModelContextLimit,
} from "../util/tokenizer.js";

import { BaseService } from "./BaseService.js";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ToolTokenEntry {
  /** Number of tool call requests from the assistant */
  requestCount: number;
  /** Tokens used in tool call requests (arguments etc.) */
  requestTokens: number;
  /** Number of tool result messages */
  resultCount: number;
  /** Tokens used in tool results */
  resultTokens: number;
  /** Total tokens = requestTokens + resultTokens */
  totalTokens: number;
}

export interface DuplicateReadEntry {
  filePath: string;
  readCount: number;
  wastedTokens: number;
}

export interface ContextBreakdown {
  system: number;
  user: number;
  assistant: number;
  tools: number;
  toolDefinitions: number;
}

export interface ContextAnalysisState {
  /** Total estimated tokens in the current context */
  totalTokens: number;
  /** Model context window limit */
  contextLimit: number;
  /** Token counts by role */
  breakdown: ContextBreakdown;
  /** Per-tool token usage, sorted by total descending */
  toolTokens: Map<string, ToolTokenEntry>;
  /** Files read more than once */
  duplicateReads: DuplicateReadEntry[];
  /** All files read this session: path → read count */
  allReadFiles: Map<string, number>;
  /** Last time analysis was run */
  lastUpdated: Date | null;
  /** Warning level based on usage ratio */
  warningLevel: "ok" | "warning" | "critical";
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const WARNING_THRESHOLD = 0.8;
const CRITICAL_THRESHOLD = 0.95;

// Tool names that read files — used for duplicate read detection
const FILE_READ_TOOLS = new Set([
  "read_file",
  "read_existing_file",
  "read_currently_open_file",
  "view_file",
  "cat",
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseFilePath(toolName: string, argsStr: string): string | null {
  if (!FILE_READ_TOOLS.has(toolName)) return null;
  try {
    const args = JSON.parse(argsStr);
    return (
      args?.filepath ?? args?.file_path ?? args?.path ?? args?.filename ?? null
    );
  } catch {
    return null;
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class ContextAnalysisService extends BaseService<ContextAnalysisState> {
  constructor() {
    super("ContextAnalysisService", {
      totalTokens: 0,
      contextLimit: 200_000,
      breakdown: {
        system: 0,
        user: 0,
        assistant: 0,
        tools: 0,
        toolDefinitions: 0,
      },
      toolTokens: new Map(),
      duplicateReads: [],
      allReadFiles: new Map(),
      lastUpdated: null,
      warningLevel: "ok",
    });
  }

  async doInitialize(): Promise<ContextAnalysisState> {
    return this.currentState;
  }

  /**
   * Recompute all context statistics from the current chat history.
   * Call this after each LLM turn.
   */
  update(
    chatHistory: ChatHistoryItem[],
    model: ModelConfig,
    systemMessage?: string,
    tools?: ChatCompletionTool[],
  ): void {
    try {
      const contextLimit = getModelContextLimit(model);
      const breakdown: ContextBreakdown = {
        system: 0,
        user: 0,
        assistant: 0,
        tools: 0,
        toolDefinitions: 0,
      };

      // toolCallId → tool name (correlated from toolCallStates)
      const callIdToTool = new Map<string, string>();
      // tool name → entry
      const toolTokens = new Map<string, ToolTokenEntry>();
      // file path → { count, totalTokens }
      const fileReads = new Map<
        string,
        { count: number; totalTokens: number }
      >();

      for (const item of chatHistory) {
        const role = item.message.role;
        const itemTokens = countChatHistoryItemTokens(item, model);

        switch (role) {
          case "system":
            breakdown.system += itemTokens;
            break;
          case "user":
            breakdown.user += itemTokens;
            break;
          case "assistant":
            breakdown.assistant += itemTokens;
            // Register tool calls for correlation
            if (item.toolCallStates) {
              for (const state of item.toolCallStates) {
                const tc = state.toolCall;
                if (!tc) continue;
                const name = tc.function?.name ?? "unknown";
                const id = tc.id ?? "";
                if (id) callIdToTool.set(id, name);

                // Estimate request tokens from name + arguments
                const argsLen = (tc.function?.arguments ?? "").length;
                const reqTokens = Math.ceil((name.length + argsLen) / 4) + 10;
                const entry = toolTokens.get(name) ?? {
                  requestCount: 0,
                  requestTokens: 0,
                  resultCount: 0,
                  resultTokens: 0,
                  totalTokens: 0,
                };
                entry.requestCount++;
                entry.requestTokens += reqTokens;
                entry.totalTokens += reqTokens;
                toolTokens.set(name, entry);
              }
            }
            break;
          case "tool": {
            breakdown.tools += itemTokens;
            const toolCallId = (item.message as any).toolCallId ?? "";
            const toolName = callIdToTool.get(toolCallId) ?? "unknown";
            const entry = toolTokens.get(toolName) ?? {
              requestCount: 0,
              requestTokens: 0,
              resultCount: 0,
              resultTokens: 0,
              totalTokens: 0,
            };
            entry.resultCount++;
            entry.resultTokens += itemTokens;
            entry.totalTokens += itemTokens;
            toolTokens.set(toolName, entry);

            // Duplicate read detection
            // Tool call arguments are in the correlated assistant item
            // Track via callIdToTool — need file path from request args
            break;
          }
        }

        // Detect duplicate file reads via toolCallStates
        if (item.toolCallStates) {
          for (const state of item.toolCallStates) {
            const tc = state.toolCall;
            if (!tc) continue;
            const name = tc.function?.name ?? "";
            const filePath = parseFilePath(name, tc.function?.arguments ?? "");
            if (filePath) {
              const outputTokens = state.output
                ? Math.ceil(
                    state.output
                      .map((o: any) => (o.content ?? "").length)
                      .reduce((a: number, b: number) => a + b, 0) / 4,
                  )
                : 0;
              const prev = fileReads.get(filePath) ?? {
                count: 0,
                totalTokens: 0,
              };
              fileReads.set(filePath, {
                count: prev.count + 1,
                totalTokens: prev.totalTokens + outputTokens,
              });
            }
          }
        }
      }

      // Count system message tokens if provided separately
      if (systemMessage) {
        const hasSystemInHistory = chatHistory.some(
          (i) => i.message.role === "system",
        );
        if (!hasSystemInHistory) {
          breakdown.system += Math.ceil(systemMessage.length / 4);
        }
      }

      // Count tool definitions
      if (tools && tools.length > 0) {
        breakdown.toolDefinitions = countToolDefinitionTokens(tools);
      }

      const totalTokens =
        breakdown.system +
        breakdown.user +
        breakdown.assistant +
        breakdown.tools +
        breakdown.toolDefinitions;

      const usageRatio = totalTokens / contextLimit;
      const warningLevel: ContextAnalysisState["warningLevel"] =
        usageRatio >= CRITICAL_THRESHOLD
          ? "critical"
          : usageRatio >= WARNING_THRESHOLD
            ? "warning"
            : "ok";

      // Build duplicate reads list
      const duplicateReads: DuplicateReadEntry[] = [];
      for (const [filePath, data] of fileReads) {
        if (data.count > 1) {
          const avgPerRead = Math.floor(data.totalTokens / data.count);
          duplicateReads.push({
            filePath,
            readCount: data.count,
            wastedTokens: avgPerRead * (data.count - 1),
          });
        }
      }
      duplicateReads.sort((a, b) => b.wastedTokens - a.wastedTokens);

      // Build allReadFiles map
      const allReadFiles = new Map<string, number>();
      for (const [filePath, data] of fileReads) {
        allReadFiles.set(filePath, data.count);
      }

      this.setState({
        totalTokens,
        contextLimit,
        breakdown,
        toolTokens,
        duplicateReads,
        allReadFiles,
        lastUpdated: new Date(),
        warningLevel,
      });
    } catch (err) {
      logger.debug("ContextAnalysisService: update error (non-fatal)", {
        error: String(err),
      });
    }
  }

  /** Returns the usage ratio (0.0 – 1.0) */
  getUsageRatio(): number {
    const { totalTokens, contextLimit } = this.currentState;
    if (contextLimit === 0) return 0;
    return totalTokens / contextLimit;
  }

  getWarningLevel(): "ok" | "warning" | "critical" {
    return this.currentState.warningLevel;
  }

  /** Format a human-readable context usage report for /context */
  formatReport(): string {
    const {
      totalTokens,
      contextLimit,
      breakdown,
      toolTokens,
      duplicateReads,
      lastUpdated,
    } = this.currentState;

    const usagePct =
      contextLimit > 0 ? Math.round((totalTokens / contextLimit) * 100) : 0;
    const bar = buildBar(usagePct);
    const lines: string[] = [];

    lines.push(
      `Context window: ${totalTokens.toLocaleString()} / ${contextLimit.toLocaleString()} tokens  (${usagePct}%)`,
    );
    lines.push(bar);
    lines.push("");
    lines.push("Breakdown:");
    lines.push(`  System:      ${fmt(breakdown.system)} tokens`);
    lines.push(`  User:        ${fmt(breakdown.user)} tokens`);
    lines.push(`  Assistant:   ${fmt(breakdown.assistant)} tokens`);
    lines.push(`  Tool results:${fmt(breakdown.tools)} tokens`);
    if (breakdown.toolDefinitions > 0) {
      lines.push(`  Tool defs:   ${fmt(breakdown.toolDefinitions)} tokens`);
    }

    if (toolTokens.size > 0) {
      const sorted = [...toolTokens.entries()].sort(
        (a, b) => b[1].totalTokens - a[1].totalTokens,
      );
      lines.push("");
      lines.push("Top tools by token cost:");
      for (const [name, entry] of sorted.slice(0, 10)) {
        lines.push(
          `  ${name.padEnd(30)} ${fmt(entry.totalTokens)} tokens  (${entry.requestCount + entry.resultCount} calls)`,
        );
      }
    }

    if (duplicateReads.length > 0) {
      lines.push("");
      lines.push(`Duplicate file reads (${duplicateReads.length} files):`);
      for (const r of duplicateReads.slice(0, 5)) {
        lines.push(
          `  ${r.filePath}  — read ${r.readCount}×, ~${fmt(r.wastedTokens)} wasted tokens`,
        );
      }
    }

    if (lastUpdated) {
      lines.push("");
      lines.push(`Last updated: ${lastUpdated.toLocaleTimeString()}`);
    }

    return lines.join("\n");
  }

  /** Format a list of files that have been read in this session (for /files) */
  formatFilesReport(): string {
    const { allReadFiles } = this.currentState;

    if (allReadFiles.size === 0) {
      return "No files in context.";
    }

    const sorted = [...allReadFiles.entries()].sort((a, b) => {
      // Sort by read count descending, then path ascending
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    });

    const lines = [`Files in context (${allReadFiles.size}):`];
    for (const [filePath, count] of sorted) {
      const suffix = count > 1 ? ` (×${count})` : "";
      lines.push(`  ${filePath}${suffix}`);
    }
    return lines.join("\n");
  }
}

// ─── Formatting helpers ────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString().padStart(8);
}

function buildBar(pct: number): string {
  const TOTAL = 30;
  const filled = Math.round((pct / 100) * TOTAL);
  const empty = TOTAL - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  const color = pct >= 95 ? "🔴" : pct >= 80 ? "🟡" : "🟢";
  return `${color} [${bar}] ${pct}%`;
}
