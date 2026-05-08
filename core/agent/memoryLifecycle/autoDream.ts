import * as fs from "fs/promises";
import * as path from "path";

import {
  stripMarkdownFrontmatter,
  wrapMarkdownWithFrontmatter,
} from "./markdown.js";

const LOCK_FILE = ".consolidate-lock";
export const AUTO_DREAM_MEMORY_FILE = "MEMORY.md";

export interface AutoDreamThresholdConfig {
  minHours: number;
  minSessions: number;
  scanThrottleMs: number;
  lockStaleMs: number;
}

export const DEFAULT_AUTO_DREAM_THRESHOLDS: AutoDreamThresholdConfig = {
  minHours: 24,
  minSessions: 5,
  scanThrottleMs: 10 * 60 * 1000,
  lockStaleMs: 60 * 60 * 1000,
};

export function evaluateAutoDreamScanGate(args: {
  lastConsolidatedAt: number;
  lastScanAt: number;
  now?: number;
  config?: Partial<AutoDreamThresholdConfig>;
}): { ready: boolean; blockedBy?: "time" | "throttle" } {
  const config = { ...DEFAULT_AUTO_DREAM_THRESHOLDS, ...args.config };
  const now = args.now ?? Date.now();
  const hoursSince = (now - args.lastConsolidatedAt) / (1000 * 60 * 60);

  if (hoursSince < config.minHours) {
    return { ready: false, blockedBy: "time" };
  }

  if (args.lastScanAt > 0 && now - args.lastScanAt < config.scanThrottleMs) {
    return { ready: false, blockedBy: "throttle" };
  }

  return { ready: true };
}

export function hasEnoughAutoDreamSessions(
  newSessionCount: number,
  config?: Partial<AutoDreamThresholdConfig>,
): boolean {
  const thresholds = { ...DEFAULT_AUTO_DREAM_THRESHOLDS, ...config };
  return newSessionCount >= thresholds.minSessions;
}

export async function getAutoDreamLockPath(memoryDir: string): Promise<string> {
  await fs.mkdir(memoryDir, { recursive: true, mode: 0o700 });
  return path.join(memoryDir, LOCK_FILE);
}

export async function readAutoDreamLastConsolidatedAt(
  memoryDir: string,
): Promise<number> {
  try {
    const stat = await fs.stat(await getAutoDreamLockPath(memoryDir));
    return stat.mtimeMs;
  } catch {
    return 0;
  }
}

export async function tryAcquireAutoDreamLock(
  memoryDir: string,
  options?: { processId?: number; lockStaleMs?: number },
): Promise<number | null> {
  const lockPath = await getAutoDreamLockPath(memoryDir);
  const processId = options?.processId ?? process.pid;
  const lockStaleMs =
    options?.lockStaleMs ?? DEFAULT_AUTO_DREAM_THRESHOLDS.lockStaleMs;
  let priorMtime = 0;
  let holderPid: number | undefined;

  try {
    const [stat, raw] = await Promise.all([
      fs.stat(lockPath),
      fs.readFile(lockPath, "utf-8"),
    ]);
    priorMtime = stat.mtimeMs;
    const parsed = parseInt(raw.trim(), 10);
    holderPid = Number.isFinite(parsed) ? parsed : undefined;
  } catch {
    // No existing lock.
  }

  if (priorMtime > 0 && Date.now() - priorMtime < lockStaleMs) {
    if (holderPid !== undefined) {
      try {
        process.kill(holderPid, 0);
        return null;
      } catch {
        // Dead PID - reclaim.
      }
    }
  }

  await fs.writeFile(lockPath, String(processId), {
    encoding: "utf-8",
    mode: 0o600,
  });
  return priorMtime;
}

export async function releaseAutoDreamLock(memoryDir: string): Promise<void> {
  const lockPath = await getAutoDreamLockPath(memoryDir);
  const now = new Date();
  try {
    await fs.utimes(lockPath, now, now);
  } catch {
    // Best effort.
  }
}

export async function rollbackAutoDreamLock(
  memoryDir: string,
  priorMtime: number,
): Promise<void> {
  const lockPath = await getAutoDreamLockPath(memoryDir);
  try {
    const time = new Date(priorMtime);
    await fs.utimes(lockPath, time, time);
  } catch {
    // Best effort.
  }
}

export async function listSessionMemoryFilesTouchedSince(
  sessionDir: string,
  sinceMs: number,
): Promise<string[]> {
  try {
    const entries = await fs.readdir(sessionDir);
    const mdFiles = entries.filter((entry) => entry.endsWith(".md"));
    const touched: string[] = [];
    for (const file of mdFiles) {
      try {
        const stat = await fs.stat(path.join(sessionDir, file));
        if (stat.mtimeMs > sinceMs) {
          touched.push(path.join(sessionDir, file));
        }
      } catch {
        // Ignore broken session files.
      }
    }
    return touched;
  } catch {
    return [];
  }
}

export function buildAutoDreamConsolidationPrompt(
  sessionFiles: string[],
  memoryFilePath: string,
  existingMemory: string,
): string {
  const fileList = sessionFiles.map((file) => `- ${file}`).join("\n");
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

function getSourceSessionIds(sessionFiles: string[]): string[] {
  return sessionFiles
    .map((file) => path.basename(file, path.extname(file)))
    .sort();
}

export function buildConsolidatedMemoryFile(args: {
  markdown: string;
  sessionFiles: string[];
  updatedAt?: number;
  source?: string;
}): string {
  const updatedAt = args.updatedAt ?? Date.now();
  const sourceSessionIds = getSourceSessionIds(args.sessionFiles);
  return wrapMarkdownWithFrontmatter(
    {
      name: "Long-term memory",
      description:
        "Consolidated durable memory synthesized from session notes.",
      type: "long-term-memory",
      source_sessions: sourceSessionIds,
      session_count: sourceSessionIds.length,
      updated_at: new Date(updatedAt).toISOString(),
      source: args.source ?? "continue",
    },
    args.markdown,
  );
}

export function stripConsolidatedMemoryFrontmatter(content: string): string {
  return stripMarkdownFrontmatter(content);
}
