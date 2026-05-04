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

import { ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import type { ChatCompletionMessageParam } from "openai/resources.mjs";

import { env } from "../env.js";
import { chatCompletionStreamWithBackoff } from "../util/exponentialBackoff.js";
import { logger } from "../util/logger.js";

import { BaseService } from "./BaseService.js";

// ─── Configuration ─────────────────────────────────────────────────────────────

const MIN_HOURS = 24;
const MIN_SESSIONS = 5;
const CONSOLIDATION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const SCAN_THROTTLE_MS = 10 * 60 * 1000; // 10 minutes
const LOCK_STALE_MS = 60 * 60 * 1000; // 1 hour
const LOCK_FILE = ".consolidate-lock";
const MEMORY_FILE = "MEMORY.md";

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
  /** Whether a consolidation is currently running */
  isRunning: boolean;
}

// ─── Lock file helpers ─────────────────────────────────────────────────────────

async function getLockPath(memoryDir: string): Promise<string> {
  await fsPromises.mkdir(memoryDir, { recursive: true, mode: 0o700 });
  return path.join(memoryDir, LOCK_FILE);
}

async function readLastConsolidatedAt(memoryDir: string): Promise<number> {
  try {
    const s = await fsPromises.stat(await getLockPath(memoryDir));
    return s.mtimeMs;
  } catch {
    return 0;
  }
}

async function tryAcquireLock(memoryDir: string): Promise<number | null> {
  const lockPath = await getLockPath(memoryDir);
  let priorMtime = 0;
  let holderPid: number | undefined;

  try {
    const [s, raw] = await Promise.all([
      fsPromises.stat(lockPath),
      fsPromises.readFile(lockPath, "utf-8"),
    ]);
    priorMtime = s.mtimeMs;
    const parsed = parseInt(raw.trim(), 10);
    holderPid = Number.isFinite(parsed) ? parsed : undefined;
  } catch {
    // No existing lock
  }

  if (priorMtime > 0 && Date.now() - priorMtime < LOCK_STALE_MS) {
    if (holderPid !== undefined) {
      try {
        process.kill(holderPid, 0); // throws if PID doesn't exist
        return null; // live holder — back off
      } catch {
        // Dead PID — reclaim
      }
    }
  }

  await fsPromises.writeFile(lockPath, String(process.pid), {
    encoding: "utf-8",
    mode: 0o600,
  });
  return priorMtime;
}

async function releaseLock(memoryDir: string): Promise<void> {
  const lockPath = await getLockPath(memoryDir);
  const now = new Date();
  try {
    await fsPromises.utimes(lockPath, now, now);
  } catch {
    // Best effort
  }
}

async function rollbackLock(
  memoryDir: string,
  priorMtime: number,
): Promise<void> {
  const lockPath = await getLockPath(memoryDir);
  try {
    const t = new Date(priorMtime);
    await fsPromises.utimes(lockPath, t, t);
  } catch {
    // Best effort
  }
}

// ─── Session file discovery ─────────────────────────────────────────────────────

async function listSessionsTouchedSince(
  sessionDir: string,
  sinceMs: number,
): Promise<string[]> {
  try {
    const entries = await fsPromises.readdir(sessionDir);
    const mdFiles = entries.filter((e: string) => e.endsWith(".md"));
    const touched: string[] = [];
    for (const file of mdFiles) {
      try {
        const s = await fsPromises.stat(path.join(sessionDir, file));
        if (s.mtimeMs > sinceMs) touched.push(path.join(sessionDir, file));
      } catch {
        // Ignore
      }
    }
    return touched;
  } catch {
    return [];
  }
}

// ─── Consolidation prompt ─────────────────────────────────────────────────────

function buildConsolidationPrompt(
  sessionFiles: string[],
  memoryFilePath: string,
  existingMemory: string,
): string {
  const fileList = sessionFiles.map((f) => `- ${f}`).join("\n");
  return `You are performing a memory consolidation — a reflective pass over recent session notes to extract durable, well-organized memories for future sessions.

Memory file: \`${memoryFilePath}\`
Session notes to review:
${fileList}

Current memory content:
<current_memory>
${existingMemory || "(empty — this is the first consolidation)"}
</current_memory>

## Instructions

1. **Read** each session notes file listed above (they are markdown files with sections like Current State, Task Specification, Learnings, etc.).

2. **Extract** what is worth remembering long-term:
   - Recurring patterns, preferences, or constraints the user has
   - Technical decisions made and why
   - Approaches that worked well or should be avoided
   - Important project-specific facts

3. **Synthesise** into the memory file. Format:
   - Use ## headings for topics (e.g. ## Coding Style, ## Project Architecture, ## Preferences)
   - Keep each bullet point factual and concise (≤ 150 chars)
   - Convert relative dates to absolute (YYYY-MM-DD)
   - Merge new learnings into existing entries rather than duplicating
   - Remove entries contradicted by newer information

Return ONLY the updated memory file content, no additional commentary.`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

let lastScanAt = 0;

export class AutoDreamService extends BaseService<AutoDreamServiceState> {
  constructor() {
    super("AutoDreamService", {
      sessionDir: getSessionDir(),
      memoryDir: getMemoryDir(),
      lastConsolidatedAt: null,
      isRunning: false,
    });
  }

  async doInitialize(): Promise<AutoDreamServiceState> {
    // Read the last consolidation timestamp from the lock file mtime
    const lastConsolidatedAt = await readLastConsolidatedAt(
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
    const memoryFilePath = path.join(this.currentState.memoryDir, MEMORY_FILE);
    try {
      return await fsPromises.readFile(memoryFilePath, "utf-8");
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
      const lastConsolidatedAt = await readLastConsolidatedAt(memoryDir);
      const hoursSince = (Date.now() - lastConsolidatedAt) / (1000 * 60 * 60);
      if (hoursSince < MIN_HOURS) return;

      // ── Gate 2: scan throttle ────────────────────────────────────────────────
      if (Date.now() - lastScanAt < SCAN_THROTTLE_MS) return;
      lastScanAt = Date.now();

      // ── Gate 3: session count ────────────────────────────────────────────────
      const newSessions = await listSessionsTouchedSince(
        sessionDir,
        lastConsolidatedAt,
      );
      if (newSessions.length < MIN_SESSIONS) return;

      // ── Gate 4: acquire lock ─────────────────────────────────────────────────
      const priorMtime = await tryAcquireLock(memoryDir);
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
          await releaseLock(memoryDir);
        } else {
          await rollbackLock(memoryDir, priorMtime);
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
    const memoryFilePath = path.join(memoryDir, MEMORY_FILE);

    let existingMemory = "";
    try {
      existingMemory = await fsPromises.readFile(memoryFilePath, "utf-8");
    } catch {
      // First consolidation
    }

    const prompt = buildConsolidationPrompt(
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
      await fsPromises.writeFile(memoryFilePath, stripped, {
        encoding: "utf-8",
        mode: 0o600,
      });
    }
  }
}
