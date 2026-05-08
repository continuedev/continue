/**
 * autoDream — ported and adapted from Marcel (Yuto Code) services/autoDream/.
 *
 * Fires a background memory consolidation after a session ends, when:
 *   1. ≥ minHours hours have elapsed since the last consolidation
 *   2. ≥ minSessions new session notes files exist since then
 *   3. No other process is currently consolidating (lock file)
 *
 * On success, it runs a background LLM pass that reads all session notes files
 * created since the last consolidation and synthesises them into a durable
 * cross-session memory file (MEMORY.md in the memory directory).
 */

import * as fs from "fs/promises";
import * as path from "path";
import { ChatMessage, ILLM } from "..";
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
} from "./memoryLifecycle/autoDream.js";

// ─── Configuration ────────────────────────────────────────────────────────────

export interface AutoDreamConfig {
  /** Minimum hours between consolidations (default: 24) */
  minHours: number;
  /** Minimum new session notes before consolidating (default: 5) */
  minSessions: number;
  /** Throttle repeated scans when the session-count gate fails */
  scanThrottleMs: number;
  /** Lock age after which a dead holder can be reclaimed */
  lockStaleMs: number;
  /** Directory containing session memory .md files */
  sessionDir: string;
  /** Directory to write the long-term MEMORY.md file */
  memoryDir: string;
}

function getDefaultDirs(): { sessionDir: string; memoryDir: string } {
  const base =
    process.env["CONTINUE_SESSION_DIR"] ??
    (process.env["TMPDIR"] ?? "/tmp") + "/continue-sessions";
  const mem =
    process.env["CONTINUE_MEMORY_DIR"] ??
    (process.env["HOME"] ?? "/tmp") + "/.continue/memories";
  return { sessionDir: base, memoryDir: mem };
}

const DEFAULTS: AutoDreamConfig = {
  ...DEFAULT_AUTO_DREAM_THRESHOLDS,
  ...getDefaultDirs(),
};

// ─── Main function ────────────────────────────────────────────────────────────

let lastScanAt = 0;

/**
 * Check gates and, if they pass, run a background consolidation pass.
 * This is designed to be called at the end of an agent session (fire-and-forget).
 * It returns immediately; the consolidation runs asynchronously.
 */
export function scheduleAutoDream(
  llm: ILLM,
  configOverrides?: Partial<AutoDreamConfig>,
): void {
  const config = { ...DEFAULTS, ...configOverrides };
  void runAutoDreamIfReady(llm, config);
}

async function runAutoDreamIfReady(
  llm: ILLM,
  config: AutoDreamConfig,
): Promise<void> {
  try {
    // ── Gate 1: time ──────────────────────────────────────────────────────────
    const lastConsolidatedAt = await readAutoDreamLastConsolidatedAt(
      config.memoryDir,
    );
    const scanGate = evaluateAutoDreamScanGate({
      lastConsolidatedAt,
      lastScanAt,
      config,
    });
    if (!scanGate.ready) return;
    lastScanAt = Date.now();

    // ── Gate 3: session count ─────────────────────────────────────────────────
    const newSessions = await listSessionMemoryFilesTouchedSince(
      config.sessionDir,
      lastConsolidatedAt,
    );
    if (!hasEnoughAutoDreamSessions(newSessions.length, config)) return;

    // ── Gate 4: acquire lock ──────────────────────────────────────────────────
    const priorMtime = await tryAcquireAutoDreamLock(config.memoryDir, {
      lockStaleMs: config.lockStaleMs,
    });
    if (priorMtime === null) return; // another process is consolidating

    let success = false;
    try {
      await runConsolidation(llm, config, newSessions);
      success = true;
    } finally {
      if (success) {
        await releaseAutoDreamLock(config.memoryDir);
      } else {
        await rollbackAutoDreamLock(config.memoryDir, priorMtime);
      }
    }
  } catch {
    // Non-fatal — consolidation failure is silent
  }
}

async function runConsolidation(
  llm: ILLM,
  config: AutoDreamConfig,
  sessionFiles: string[],
): Promise<void> {
  await fs.mkdir(config.memoryDir, { recursive: true, mode: 0o700 });
  const memoryFilePath = path.join(config.memoryDir, AUTO_DREAM_MEMORY_FILE);

  let existingMemory = "";
  try {
    existingMemory = stripConsolidatedMemoryFrontmatter(
      await fs.readFile(memoryFilePath, "utf-8"),
    );
  } catch {
    // First consolidation
  }

  const prompt = buildAutoDreamConsolidationPrompt(
    sessionFiles,
    memoryFilePath,
    existingMemory,
  );

  // Build a minimal conversation for the consolidation LLM call
  const messages: ChatMessage[] = [{ role: "user", content: prompt }];

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 5 * 60 * 1000); // 5 min timeout

  let memoryContent = "";
  try {
    const gen = llm.streamChat(messages, abortController.signal, {
      maxTokens: 8192,
    });
    for await (const chunk of gen) {
      if (typeof chunk.content === "string") {
        memoryContent += chunk.content;
      }
    }
  } finally {
    clearTimeout(timeout);
  }

  // Strip markdown code fences if present
  const stripped = memoryContent
    .replace(/^```(?:markdown)?\n?/, "")
    .replace(/\n?```$/, "")
    .trim();

  if (stripped.length > 50) {
    await fs.writeFile(
      memoryFilePath,
      buildConsolidatedMemoryFile({
        markdown: stripped,
        sessionFiles,
        updatedAt: Date.now(),
        source: "continue-core",
      }),
      {
        encoding: "utf-8",
        mode: 0o600,
      },
    );
  }
}

// ─── Reader ───────────────────────────────────────────────────────────────────

/**
 * Read the consolidated long-term memory file, if it exists.
 * Returns null if no memory has been consolidated yet.
 */
export async function readLongTermMemory(
  configOverrides?: Partial<AutoDreamConfig>,
): Promise<string | null> {
  const config = { ...DEFAULTS, ...configOverrides };
  const memoryFilePath = path.join(config.memoryDir, AUTO_DREAM_MEMORY_FILE);
  try {
    return stripConsolidatedMemoryFrontmatter(
      await fs.readFile(memoryFilePath, "utf-8"),
    );
  } catch {
    return null;
  }
}
