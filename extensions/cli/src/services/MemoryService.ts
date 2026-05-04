import type { Dirent } from "fs";
import fsPromises from "fs/promises";
import * as path from "path";

import { env } from "../env.js";
import { logger } from "../util/logger.js";

import { BaseService } from "./BaseService.js";

export interface MemoryEntry {
  /** Absolute path to the memory file */
  filePath: string;
  /** File name without extension */
  name: string;
  /** Last modification time */
  mtime: Date;
  /** Cached content (lazy-loaded) */
  content?: string;
}

export interface RelevantMemory {
  filePath: string;
  name: string;
  content: string;
  score: number;
}

export interface MemoryServiceState {
  memoryDir: string;
  entries: MemoryEntry[];
  lastScanned: Date | null;
}

const MAX_MEMORY_FILES = 50;
const MAX_MEMORY_CONTENT_BYTES = 25 * 1024; // 25 KB per file
const MAX_MEMORY_LINES = 200;
const MAX_INJECTED_MEMORIES = 5;
const SCAN_DEBOUNCE_MS = 5000;

/**
 * Truncates memory content to line/byte limits with a warning suffix.
 */
function truncateMemory(content: string): string {
  const lines = content.split("\n");
  if (lines.length > MAX_MEMORY_LINES) {
    const truncated = lines.slice(0, MAX_MEMORY_LINES).join("\n");
    return (
      truncated +
      `\n<!-- truncated: exceeded ${MAX_MEMORY_LINES}-line limit -->`
    );
  }

  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes > MAX_MEMORY_CONTENT_BYTES) {
    // Slice roughly at the byte limit
    const truncated = content.slice(0, MAX_MEMORY_CONTENT_BYTES);
    return (
      truncated +
      `\n<!-- truncated: exceeded ${MAX_MEMORY_CONTENT_BYTES / 1024}KB limit -->`
    );
  }

  return content;
}

/**
 * Simple keyword-based relevance scoring.
 * Splits query into tokens and counts how many appear in the file name or content.
 */
function scoreRelevance(
  entry: MemoryEntry,
  query: string,
  content: string,
): number {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);
  if (tokens.length === 0) return 0;

  const searchTarget = `${entry.name} ${content}`.toLowerCase();
  const matchCount = tokens.filter((t) => searchTarget.includes(t)).length;
  const recencyBonus =
    1 -
    Math.min(Date.now() - entry.mtime.getTime(), 7 * 86400000) / (7 * 86400000); // Decay over 7 days

  return matchCount / tokens.length + recencyBonus * 0.2;
}

/**
 * MemoryService manages a directory of markdown memory files.
 *
 * On each query, it scans the directory, loads file content, scores entries
 * by keyword relevance + recency, and returns the top N memories to inject
 * into the system message. This mirrors Marcel's memdir behavior without
 * requiring a costly side-LLM-query.
 */
export class MemoryService extends BaseService<MemoryServiceState> {
  private lastScanTime = 0;

  constructor() {
    super("MemoryService", {
      memoryDir: path.join(env.continueHome, "memories"),
      entries: [],
      lastScanned: null,
    });
  }

  async doInitialize(args?: {
    memoryDir?: string;
  }): Promise<MemoryServiceState> {
    const memoryDir =
      args?.memoryDir ?? path.join(env.continueHome, "memories");

    // Create directory if it doesn't exist
    try {
      await fsPromises.mkdir(memoryDir, { recursive: true });
    } catch (err) {
      logger.warn("MemoryService: could not create memory directory", { err });
    }

    this.setState({ memoryDir });
    await this.scan();

    logger.debug("MemoryService initialized", {
      memoryDir,
      entryCount: this.currentState.entries.length,
    });

    return this.currentState;
  }

  /**
   * Scan the memory directory and refresh the entry list.
   * Debounced to avoid repeated filesystem calls.
   */
  async scan(): Promise<void> {
    const now = Date.now();
    if (now - this.lastScanTime < SCAN_DEBOUNCE_MS && this.lastScanTime > 0) {
      return;
    }
    this.lastScanTime = now;

    const { memoryDir } = this.currentState;
    try {
      const dirents = await fsPromises.readdir(memoryDir, {
        withFileTypes: true,
      });

      const mdFiles = dirents
        .filter(
          (d: Dirent) =>
            d.isFile() && (d.name.endsWith(".md") || d.name.endsWith(".txt")),
        )
        .slice(0, MAX_MEMORY_FILES);

      const entries: MemoryEntry[] = await Promise.all(
        mdFiles.map(async (d: Dirent) => {
          const filePath = path.join(memoryDir, d.name);
          const stat = await fsPromises.stat(filePath);
          return {
            filePath,
            name: d.name.replace(/\.(md|txt)$/, ""),
            mtime: stat.mtime,
          };
        }),
      );

      // Sort newest first
      entries.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      this.setState({ entries, lastScanned: new Date() });
    } catch (err) {
      logger.warn("MemoryService: failed to scan memory directory", { err });
    }
  }

  /**
   * Find the most relevant memories for a given query string.
   * Returns up to MAX_INJECTED_MEMORIES entries sorted by relevance score.
   */
  async findRelevantMemories(
    query: string,
    alreadySurfaced: ReadonlySet<string> = new Set(),
  ): Promise<RelevantMemory[]> {
    await this.scan();

    const { entries } = this.currentState;
    const candidates = entries.filter((e) => !alreadySurfaced.has(e.filePath));

    const scored: Array<RelevantMemory> = [];

    for (const entry of candidates) {
      try {
        const raw = await fsPromises.readFile(entry.filePath, "utf8");
        const content = truncateMemory(raw);
        const score = scoreRelevance(entry, query, content);
        scored.push({
          filePath: entry.filePath,
          name: entry.name,
          content,
          score,
        });
      } catch (err) {
        logger.warn(`MemoryService: could not read ${entry.filePath}`, { err });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, MAX_INJECTED_MEMORIES);
  }

  /**
   * Write or update a memory file.
   */
  async writeMemory(name: string, content: string): Promise<string> {
    const { memoryDir } = this.currentState;
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filePath = path.join(memoryDir, `${safeName}.md`);
    await fsPromises.writeFile(filePath, content, "utf8");
    this.lastScanTime = 0; // Force re-scan
    logger.debug(`MemoryService: wrote memory "${name}"`, { filePath });
    return filePath;
  }

  /**
   * Delete a memory file by name.
   */
  async deleteMemory(name: string): Promise<void> {
    const { entries } = this.currentState;
    const entry = entries.find((e) => e.name === name);
    if (!entry) {
      throw new Error(`Memory "${name}" not found`);
    }
    await fsPromises.unlink(entry.filePath);
    this.lastScanTime = 0;
    logger.debug(`MemoryService: deleted memory "${name}"`);
  }

  /**
   * List all memory names.
   */
  listMemories(): Array<{ name: string; mtime: Date }> {
    return this.currentState.entries.map((e) => ({
      name: e.name,
      mtime: e.mtime,
    }));
  }

  /**
   * Format relevant memories as a markdown block for injection into system messages.
   */
  async formatMemoriesForSystemMessage(query: string): Promise<string | null> {
    const memories = await this.findRelevantMemories(query);
    if (memories.length === 0) return null;

    const blocks = memories.map((m) => `### Memory: ${m.name}\n\n${m.content}`);

    return (
      "# Relevant Memories\n\n" +
      "_These memories were selected as relevant to the current task:_\n\n" +
      blocks.join("\n\n---\n\n")
    );
  }

  getMemoryDir(): string {
    return this.currentState.memoryDir;
  }
}
