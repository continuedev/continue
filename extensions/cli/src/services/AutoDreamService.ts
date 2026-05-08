/**
 * AutoDreamService — cross-session memory consolidation.
 *
 * Adapted from core/agent/autoDream.ts for the Continue CLI, using
 * BaseLlmApi / ModelConfig instead of the core ILLM interface.
 *
 * After a session ends, if:
 *   1. ≥ minHours hours have passed since the last consolidation
 *   2. ≥ minSessions new session notes files exist since then
 *   3. No other process is currently consolidating (lock file)
 *
 * …a background LLM pass synthesises all new session notes into a durable
 * MEMORY.md file at ~/.continue/memories/MEMORY.md.
 *
 * Because MemoryService already scans ~/.continue/memories/, the consolidated
 * memory is automatically injected into future system messages — no extra
 * wiring required.
 */

import fsPromises from "fs/promises";
import * as path from "path";

import { ModelConfig } from "@yutoagentic/config-yaml";
import { BaseLlmApi } from "@yutoagentic/openai-adapters";
import {
  AUTO_DREAM_MEMORY_FILE,
  buildAutoDreamConsolidationPrompt,
  buildConsolidatedMemoryFile,
  DEFAULT_AUTO_DREAM_THRESHOLDS,
  evaluateAutoDreamScanGate,
  hasEnoughAutoDreamSessions,
  listSessionMemoryFilesTouchedSince,
  readAutoDreamLastConsolidatedAt,
  releaseAutoDreamLock,
  rollbackAutoDreamLock,
  stripConsolidatedMemoryFrontmatter,
  tryAcquireAutoDreamLock,
} from "core/agent/memoryLifecycle/autoDream.js";
import type { ChatCompletionMessageParam } from "openai/resources.mjs";

import { env } from "../env.js";
import { chatCompletionStreamWithBackoff } from "../util/exponentialBackoff.js";
import { logger } from "../util/logger.js";

import { BaseService } from "./BaseService.js";

// ─── Configuration ─────────────────────────────────────────────────────────────

const CONSOLIDATION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const AUTO_DREAM_THRESHOLDS = DEFAULT_AUTO_DREAM_THRESHOLDS;
const AUTO_DREAM_SOURCE = "continue-cli";

function getSessionDir(): string {
  return (
    process.env["CONTINUE_SESSION_DIR"] ??
    path.join(process.env["TMPDIR"] ?? "/tmp", "continue-sessions")
  );
}

function getMemoryDir(): string {
  return (
    process.env["CONTINUE_MEMORY_DIR"] ??
    path.join(env.continueHome, "memories")
  );
}

// ─── State ────────────────────────────────────────────────────────────────────

export interface AutoDreamServiceState {
  sessionDir: string;
  memoryDir: string;
  /** Timestamp of last successful consolidation (null = never) */
  lastConsolidatedAt: number | null;
  /** Timestamp of the most recent filesystem scan attempt */
  lastScanAt: number | null;
  /** Whether a consolidation is currently running */
  isRunning: boolean;
}
// ─── Service ──────────────────────────────────────────────────────────────────

export class AutoDreamService extends BaseService<AutoDreamServiceState> {
  constructor() {
    super("AutoDreamService", {
      sessionDir: getSessionDir(),
      memoryDir: getMemoryDir(),
      lastConsolidatedAt: null,
      lastScanAt: null,
      isRunning: false,
    });
  }

  async doInitialize(): Promise<AutoDreamServiceState> {
    // Read the last consolidation timestamp from the lock file mtime
    const lastConsolidatedAt = await readAutoDreamLastConsolidatedAt(
      this.currentState.memoryDir,
    );
    this.setState({ lastConsolidatedAt: lastConsolidatedAt || null });
    logger.debug("AutoDreamService initialized", {
      lastConsolidatedAt: this.currentState.lastConsolidatedAt
        ? new Date(this.currentState.lastConsolidatedAt).toISOString()
        : "never",
    });
    return this.currentState;
  }

  /**
   * Fire-and-forget: check gates and, if they pass, consolidate session notes
   * into MEMORY.md. Call this at the end of a session / when the stream loop
   * finishes.
   */
  schedule(llmApi: BaseLlmApi, model: ModelConfig): void {
    if (this.currentState.isRunning) return;
    void this.runIfReady(llmApi, model);
  }

  /** Read the current consolidated long-term memory, if it exists */
  async readLongTermMemory(): Promise<string | null> {
    const memoryFilePath = path.join(
      this.currentState.memoryDir,
      AUTO_DREAM_MEMORY_FILE,
    );
    try {
      return stripConsolidatedMemoryFrontmatter(
        await fsPromises.readFile(memoryFilePath, "utf-8"),
      );
    } catch {
      return null;
    }
  }

  private async runIfReady(
    llmApi: BaseLlmApi,
    model: ModelConfig,
  ): Promise<void> {
    const { sessionDir, memoryDir } = this.currentState;

    try {
      // ── Gate 1: time ────────────────────────────────────────────────────────
      const lastConsolidatedAt =
        await readAutoDreamLastConsolidatedAt(memoryDir);
      const scanGate = evaluateAutoDreamScanGate({
        lastConsolidatedAt,
        lastScanAt: this.currentState.lastScanAt ?? 0,
        config: AUTO_DREAM_THRESHOLDS,
      });
      if (!scanGate.ready) return;
      this.setState({ lastScanAt: Date.now() });

      // ── Gate 3: session count ────────────────────────────────────────────────
      const newSessions = await listSessionMemoryFilesTouchedSince(
        sessionDir,
        lastConsolidatedAt,
      );
      if (
        !hasEnoughAutoDreamSessions(newSessions.length, AUTO_DREAM_THRESHOLDS)
      ) {
        return;
      }

      // ── Gate 4: acquire lock ─────────────────────────────────────────────────
      const priorMtime = await tryAcquireAutoDreamLock(memoryDir, {
        lockStaleMs: AUTO_DREAM_THRESHOLDS.lockStaleMs,
      });
      if (priorMtime === null) return; // another process is consolidating

      this.setState({ isRunning: true });
      let success = false;
      try {
        await this.runConsolidation(llmApi, model, newSessions);
        success = true;
        this.setState({ lastConsolidatedAt: Date.now() });
        logger.debug("AutoDreamService: consolidation complete", {
          sessions: newSessions.length,
        });
      } finally {
        this.setState({ isRunning: false });
        if (success) {
          await releaseAutoDreamLock(memoryDir);
        } else {
          await rollbackAutoDreamLock(memoryDir, priorMtime);
        }
      }
    } catch {
      // Non-fatal — consolidation failure is silent
      this.setState({ isRunning: false });
    }
  }

  private async runConsolidation(
    llmApi: BaseLlmApi,
    model: ModelConfig,
    sessionFiles: string[],
  ): Promise<void> {
    const { memoryDir } = this.currentState;
    await fsPromises.mkdir(memoryDir, { recursive: true, mode: 0o700 });
    const memoryFilePath = path.join(memoryDir, AUTO_DREAM_MEMORY_FILE);

    let existingMemory = "";
    try {
      existingMemory = stripConsolidatedMemoryFrontmatter(
        await fsPromises.readFile(memoryFilePath, "utf-8"),
      );
    } catch {
      // First consolidation
    }

    const prompt = buildAutoDreamConsolidationPrompt(
      sessionFiles,
      memoryFilePath,
      existingMemory,
    );

    const messages: ChatCompletionMessageParam[] = [
      { role: "user", content: prompt },
    ];

    const abortController = new AbortController();
    const timeout = setTimeout(
      () => abortController.abort(),
      CONSOLIDATION_TIMEOUT_MS,
    );

    let memoryContent = "";
    try {
      const stream = chatCompletionStreamWithBackoff(
        llmApi,
        {
          model: model.model,
          messages,
          stream: true as const,
          max_tokens: 8192,
        },
        abortController.signal,
      );
      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) memoryContent += delta;
      }
    } finally {
      clearTimeout(timeout);
    }

    const stripped = memoryContent
      .replace(/^```(?:markdown)?\n?/, "")
      .replace(/\n?```$/, "")
      .trim();

    if (stripped.length > 50) {
      await fsPromises.writeFile(
        memoryFilePath,
        buildConsolidatedMemoryFile({
          markdown: stripped,
          sessionFiles,
          updatedAt: Date.now(),
          source: AUTO_DREAM_SOURCE,
        }),
        {
          encoding: "utf-8",
          mode: 0o600,
        },
      );
    }
  }
}
