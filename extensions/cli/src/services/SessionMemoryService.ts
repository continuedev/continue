/**
 * SessionMemoryService — per-session structured markdown notes.
 *
 * Adapted from core/agent/SessionMemory.ts for the Continue CLI, using
 * BaseLlmApi / ModelConfig instead of the core ILLM interface.
 *
 * During a session, after N tool calls AND sufficient token growth, a background
 * LLM pass updates the notes file at:
 *   <sessionDir>/<sessionId>.md
 *
 * The notes file feeds AutoDreamService's consolidation pass at session end.
 */

import { randomUUID } from "crypto";
import fsPromises from "fs/promises";
import * as path from "path";

import { ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import type { ChatHistoryItem } from "core/index.js";
import { convertFromUnifiedHistoryWithSystemMessage } from "core/util/messageConversion.js";
import type { ChatCompletionMessageParam } from "openai/resources.mjs";

import { chatCompletionStreamWithBackoff } from "../util/exponentialBackoff.js";
import { logger } from "../util/logger.js";

import { BaseService } from "./BaseService.js";

// ─── Configuration ─────────────────────────────────────────────────────────────

const MIN_TOKENS_TO_INIT = 10_000;
const MIN_TOKEN_GROWTH = 5_000;
const MIN_TOOL_CALLS = 3;
const EXTRACTION_TIMEOUT_MS = 60_000;

function getSessionDir(): string {
  return (
    process.env["CONTINUE_SESSION_DIR"] ??
    path.join(process.env["TMPDIR"] ?? "/tmp", "continue-sessions")
  );
}

// ─── Session notes template ────────────────────────────────────────────────────

const SESSION_MEMORY_TEMPLATE = `# Session Title
_A short and distinctive 5-10 word descriptive title for the session_

# Current State
_What is actively being worked on right now? Pending tasks not yet completed. Immediate next steps._

# Task Specification
_What did the user ask to build? Any design decisions or explanatory context._

# Files and Functions
_Important files — what they contain and why they are relevant._

# Workflow
_Commands usually run and in what order. How to interpret their output if not obvious._

# Errors & Corrections
_Errors encountered and how they were fixed. Approaches that failed and should not be retried._

# Codebase and System Documentation
_Important system components. How they work/fit together._

# Learnings
_What has worked well? What has not? What to avoid?_

# Worklog
_Step by step, terse summary of what was attempted/done._
`;

// ─── State ────────────────────────────────────────────────────────────────────

export interface SessionMemoryServiceState {
  sessionId: string;
  sessionDir: string;
  notesPath: string;
  /** Cumulative tool calls in this session */
  totalToolCalls: number;
  /** Tool calls since last extraction */
  toolCallsSinceExtraction: number;
  /** Estimated tokens at the time of last extraction */
  tokensAtLastExtraction: number;
  /** Whether extraction threshold has ever been met (init gate) */
  initialized: boolean;
  /** Whether a background extraction is currently running */
  isExtracting: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function estimateTokens(history: ChatHistoryItem[]): number {
  let chars = 0;
  for (const item of history) {
    const content = item.message?.content;
    if (typeof content === "string") {
      chars += content.length;
    } else if (Array.isArray(content)) {
      for (const part of content as any[]) {
        if (typeof part?.text === "string") chars += part.text.length;
      }
    }
  }
  return Math.ceil(chars / 4);
}

async function ensureNotesFile(notesPath: string): Promise<string> {
  const dir = path.dirname(notesPath);
  await fsPromises.mkdir(dir, { recursive: true, mode: 0o700 });
  try {
    return await fsPromises.readFile(notesPath, "utf-8");
  } catch {
    await fsPromises.writeFile(notesPath, SESSION_MEMORY_TEMPLATE, {
      encoding: "utf-8",
      mode: 0o600,
    });
    return SESSION_MEMORY_TEMPLATE;
  }
}

function buildExtractionPrompt(
  currentNotes: string,
  notesPath: string,
): string {
  return `You are a session note-keeper. Based on the conversation above, update the session notes file.

Current notes content:
<current_notes>
${currentNotes}
</current_notes>

Your ONLY task: update the notes file at \`${notesPath}\` to reflect the latest state of the session. Rules:
- Maintain the EXACT file structure (all section headers and italic description lines must be preserved verbatim).
- Update content within sections only — never modify headers or the italic _description_ lines.
- Be terse. Each section should be densely informative, not verbose.
- Do not add a section for "Session Memory Update" or reference these instructions.
- Return ONLY the updated notes content, no additional commentary.
- After writing, stop immediately.`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class SessionMemoryService extends BaseService<SessionMemoryServiceState> {
  constructor() {
    const sessionId = randomUUID();
    const sessionDir = getSessionDir();
    super("SessionMemoryService", {
      sessionId,
      sessionDir,
      notesPath: path.join(sessionDir, `${sessionId}.md`),
      totalToolCalls: 0,
      toolCallsSinceExtraction: 0,
      tokensAtLastExtraction: 0,
      initialized: false,
      isExtracting: false,
    });
  }

  async doInitialize(): Promise<SessionMemoryServiceState> {
    // Ensure session directory exists
    try {
      await fsPromises.mkdir(this.currentState.sessionDir, {
        recursive: true,
        mode: 0o700,
      });
    } catch {
      // Non-fatal
    }
    logger.debug("SessionMemoryService initialized", {
      sessionId: this.currentState.sessionId,
      notesPath: this.currentState.notesPath,
    });
    return this.currentState;
  }

  /** Start a new session (called when the user clears the chat) */
  newSession(): void {
    const sessionId = randomUUID();
    const sessionDir = this.currentState.sessionDir;
    this.setState({
      sessionId,
      notesPath: path.join(sessionDir, `${sessionId}.md`),
      totalToolCalls: 0,
      toolCallsSinceExtraction: 0,
      tokensAtLastExtraction: 0,
      initialized: false,
      isExtracting: false,
    });
    logger.debug("SessionMemoryService: new session started", { sessionId });
  }

  /** Record tool calls that occurred in the latest turn */
  recordToolCalls(count: number): void {
    if (count <= 0) return;
    this.setState({
      totalToolCalls: this.currentState.totalToolCalls + count,
      toolCallsSinceExtraction:
        this.currentState.toolCallsSinceExtraction + count,
    });
  }

  /** Get the current session notes path (for AutoDreamService) */
  getNotesPath(): string {
    return this.currentState.notesPath;
  }

  /** Get the session directory */
  getSessionDir(): string {
    return this.currentState.sessionDir;
  }

  /**
   * Check thresholds and, if met, fire a background extraction.
   * Call this after each tool-call batch in the stream loop.
   * Returns immediately — extraction runs asynchronously.
   */
  maybeExtract(
    chatHistory: ChatHistoryItem[],
    llmApi: BaseLlmApi,
    model: ModelConfig,
  ): void {
    if (!this.shouldExtract(chatHistory)) return;

    const notesPath = this.currentState.notesPath;
    // Capture snapshot of counter state before async work
    const tokenSnapshot = estimateTokens(chatHistory);

    this.setState({
      isExtracting: true,
      initialized: true,
      toolCallsSinceExtraction: 0,
      tokensAtLastExtraction: tokenSnapshot,
    });

    void this.runExtraction(chatHistory, llmApi, model, notesPath).finally(
      () => {
        this.setState({ isExtracting: false });
      },
    );
  }

  private shouldExtract(chatHistory: ChatHistoryItem[]): boolean {
    const state = this.currentState;
    if (state.isExtracting) return false;

    const currentTokens = estimateTokens(chatHistory);

    if (!state.initialized) {
      if (currentTokens < MIN_TOKENS_TO_INIT) return false;
    }

    const tokenGrowth = currentTokens - state.tokensAtLastExtraction;
    if (tokenGrowth < MIN_TOKEN_GROWTH) return false;

    return state.toolCallsSinceExtraction >= MIN_TOOL_CALLS;
  }

  private async runExtraction(
    chatHistory: ChatHistoryItem[],
    llmApi: BaseLlmApi,
    model: ModelConfig,
    notesPath: string,
  ): Promise<void> {
    try {
      const currentNotes = await ensureNotesFile(notesPath);
      const extractionPrompt = buildExtractionPrompt(currentNotes, notesPath);

      // Build extraction conversation: full history + extraction instruction
      const openaiMessages = convertFromUnifiedHistoryWithSystemMessage(
        chatHistory,
        "",
      ) as ChatCompletionMessageParam[];
      openaiMessages.push({ role: "user", content: extractionPrompt });

      const abortController = new AbortController();
      const timeout = setTimeout(
        () => abortController.abort(),
        EXTRACTION_TIMEOUT_MS,
      );

      let notesContent = "";
      try {
        const stream = chatCompletionStreamWithBackoff(
          llmApi,
          {
            model: model.model,
            messages: openaiMessages,
            stream: true as const,
            max_tokens: 4096,
          },
          abortController.signal,
        );
        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) notesContent += delta;
        }
      } finally {
        clearTimeout(timeout);
      }

      const stripped = notesContent
        .replace(/^```(?:markdown)?\n?/, "")
        .replace(/\n?```$/, "")
        .trim();

      if (stripped.length > 100) {
        await fsPromises.writeFile(notesPath, stripped, {
          encoding: "utf-8",
          mode: 0o600,
        });
        logger.debug("SessionMemoryService: notes extracted", { notesPath });
      }
    } catch (err) {
      // Extraction failure is non-fatal
      logger.debug("SessionMemoryService: extraction failed (non-fatal)", {
        error: String(err),
      });
    }
  }
}
