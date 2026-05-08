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

import { ModelConfig } from "@yutoagentic/config-yaml";
import { BaseLlmApi } from "@yutoagentic/openai-adapters";
import {
  buildSessionMemoryExtractionPrompt,
  buildSessionMemoryFile,
  DEFAULT_SESSION_MEMORY_THRESHOLDS,
  ensureSessionMemoryFile,
  SESSION_MEMORY_TEMPLATE,
  shouldExtractSessionMemoryGate,
} from "core/agent/memoryLifecycle/sessionMemory.js";
import type { ChatHistoryItem } from "core/index.js";
import { convertFromUnifiedHistoryWithSystemMessage } from "core/util/messageConversion.js";
import type { ChatCompletionMessageParam } from "openai/resources.mjs";

import { chatCompletionStreamWithBackoff } from "../util/exponentialBackoff.js";
import { logger } from "../util/logger.js";

import { BaseService } from "./BaseService.js";

// ─── Configuration ─────────────────────────────────────────────────────────────

const EXTRACTION_TIMEOUT_MS = 60_000;
const SESSION_MEMORY_SOURCE = "continue-cli";

function getSessionDir(): string {
  return (
    process.env["CONTINUE_SESSION_DIR"] ??
    path.join(process.env["TMPDIR"] ?? "/tmp", "continue-sessions")
  );
}

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
  /** Timestamp of the most recent extraction attempt */
  lastExtractedAt: number | null;
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
      lastExtractedAt: null,
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
      lastExtractedAt: null,
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
      lastExtractedAt: Date.now(),
    });

    void this.runExtraction(chatHistory, llmApi, model, notesPath).finally(
      () => {
        this.setState({ isExtracting: false });
      },
    );
  }

  private shouldExtract(chatHistory: ChatHistoryItem[]): boolean {
    const state = this.currentState;
    return shouldExtractSessionMemoryGate({
      extracting: state.isExtracting,
      initialized: state.initialized,
      currentTokens: estimateTokens(chatHistory),
      tokensAtLastExtraction: state.tokensAtLastExtraction,
      toolCallsSinceExtraction: state.toolCallsSinceExtraction,
      config: DEFAULT_SESSION_MEMORY_THRESHOLDS,
    });
  }

  private async runExtraction(
    chatHistory: ChatHistoryItem[],
    llmApi: BaseLlmApi,
    model: ModelConfig,
    notesPath: string,
  ): Promise<void> {
    try {
      const currentNotes = await ensureSessionMemoryFile(notesPath, {
        sessionId: this.currentState.sessionId,
        totalToolCalls: this.currentState.totalToolCalls,
        template: SESSION_MEMORY_TEMPLATE,
        source: SESSION_MEMORY_SOURCE,
      });
      const extractionPrompt = buildSessionMemoryExtractionPrompt(
        currentNotes,
        notesPath,
      );

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
        await fsPromises.writeFile(
          notesPath,
          buildSessionMemoryFile({
            sessionId: this.currentState.sessionId,
            markdown: stripped,
            totalToolCalls: this.currentState.totalToolCalls,
            updatedAt: Date.now(),
            source: SESSION_MEMORY_SOURCE,
          }),
          {
            encoding: "utf-8",
            mode: 0o600,
          },
        );
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
