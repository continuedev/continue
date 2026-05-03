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

// ─── Configuration ────────────────────────────────────────────────────────────

export interface AutoDreamConfig {
  /** Minimum hours between consolidations (default: 24) */
  minHours: number;
  /** Minimum new session notes before consolidating (default: 5) */
  minSessions: number;
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
  minHours: 24,
  minSessions: 5,
  ...getDefaultDirs(),
};

// ─── Lock file ────────────────────────────────────────────────────────────────

const LOCK_FILE = ".consolidate-lock";
const HOLDER_STALE_MS = 60 * 60 * 1000; // 1 hour

async function getLockPath(config: AutoDreamConfig): Promise<string> {
  await fs.mkdir(config.memoryDir, { recursive: true, mode: 0o700 });
  return path.join(config.memoryDir, LOCK_FILE);
}

/**
 * Returns the mtime of the lock file (= timestamp of last consolidation).
 * Returns 0 if the lock file does not exist.
 */
async function readLastConsolidatedAt(
  config: AutoDreamConfig,
): Promise<number> {
  try {
    const s = await fs.stat(await getLockPath(config));
    return s.mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * Try to acquire the consolidation lock.
 * Returns the prior mtime on success, null if locked by another live process.
 */
async function tryAcquireLock(config: AutoDreamConfig): Promise<number | null> {
  const lockPath = await getLockPath(config);
  let priorMtime = 0;
  let holderPid: number | undefined;

  try {
    const [s, raw] = await Promise.all([
      fs.stat(lockPath),
      fs.readFile(lockPath, "utf-8"),
    ]);
    priorMtime = s.mtimeMs;
    const parsed = parseInt(raw.trim(), 10);
    holderPid = Number.isFinite(parsed) ? parsed : undefined;
  } catch {
    // No existing lock
  }

  // Check if an existing lock is still fresh with a live holder
  if (priorMtime > 0 && Date.now() - priorMtime < HOLDER_STALE_MS) {
    if (holderPid !== undefined) {
      try {
        process.kill(holderPid, 0); // throws if PID doesn't exist
        return null; // live holder — back off
      } catch {
        // Dead PID — reclaim
      }
    }
  }

  await fs.writeFile(lockPath, String(process.pid), {
    encoding: "utf-8",
    mode: 0o600,
  });
  return priorMtime;
}

async function releaseLock(
  config: AutoDreamConfig,
  priorMtime: number,
): Promise<void> {
  const lockPath = await getLockPath(config);
  const now = new Date();
  try {
    await fs.utimes(lockPath, now, now);
  } catch {
    // Best effort
  }
}

async function rollbackLock(
  config: AutoDreamConfig,
  priorMtime: number,
): Promise<void> {
  const lockPath = await getLockPath(config);
  try {
    const t = new Date(priorMtime);
    await fs.utimes(lockPath, t, t);
  } catch {
    // Best effort
  }
}

// ─── Gate checks ─────────────────────────────────────────────────────────────

async function listSessionsTouchedSince(
  sessionDir: string,
  sinceMs: number,
): Promise<string[]> {
  try {
    const entries = await fs.readdir(sessionDir);
    const mdFiles = entries.filter((e: string) => e.endsWith(".md"));
    const touched: string[] = [];
    for (const file of mdFiles) {
      try {
        const s = await fs.stat(path.join(sessionDir, file));
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
  memoryDir: string,
  memoryFilePath: string,
  existingMemory: string,
): string {
  const fileList = sessionFiles.map((f) => `- ${f}`).join("\n");
  return `You are performing a memory consolidation — a reflective pass over recent session notes to extract durable, well-organized memories for future sessions.

Memory file: \`${memoryFilePath}\`
Session notes to review:\n${fileList}

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

4. Write the updated memory file to \`${memoryFilePath}\` and stop.`;
}

// ─── Main function ────────────────────────────────────────────────────────────

const MEMORY_FILE = "MEMORY.md";
// Throttle: don't scan sessions too frequently when the time gate passes but
// the session gate doesn't, to avoid redundant stat calls every turn.
const SCAN_THROTTLE_MS = 10 * 60 * 1000; // 10 minutes
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
    const lastConsolidatedAt = await readLastConsolidatedAt(config);
    const hoursSince = (Date.now() - lastConsolidatedAt) / (1000 * 60 * 60);
    if (hoursSince < config.minHours) return;

    // ── Gate 2: scan throttle ─────────────────────────────────────────────────
    if (Date.now() - lastScanAt < SCAN_THROTTLE_MS) return;
    lastScanAt = Date.now();

    // ── Gate 3: session count ─────────────────────────────────────────────────
    const newSessions = await listSessionsTouchedSince(
      config.sessionDir,
      lastConsolidatedAt,
    );
    if (newSessions.length < config.minSessions) return;

    // ── Gate 4: acquire lock ──────────────────────────────────────────────────
    const priorMtime = await tryAcquireLock(config);
    if (priorMtime === null) return; // another process is consolidating

    let success = false;
    try {
      await runConsolidation(llm, config, newSessions);
      success = true;
    } finally {
      if (success) {
        await releaseLock(config, priorMtime);
      } else {
        await rollbackLock(config, priorMtime);
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
  const memoryFilePath = path.join(config.memoryDir, MEMORY_FILE);

  let existingMemory = "";
  try {
    existingMemory = await fs.readFile(memoryFilePath, "utf-8");
  } catch {
    // First consolidation
  }

  const prompt = buildConsolidationPrompt(
    sessionFiles,
    config.memoryDir,
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
    await fs.writeFile(memoryFilePath, stripped, {
      encoding: "utf-8",
      mode: 0o600,
    });
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
  const memoryFilePath = path.join(config.memoryDir, MEMORY_FILE);
  try {
    return await fs.readFile(memoryFilePath, "utf-8");
  } catch {
    return null;
  }
}
