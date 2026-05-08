import fsPromises from "fs/promises";
import * as path from "path";

import { parseMarkdownRule } from "@yutoagentic/config-yaml";
import { findRelevantMemories as findRelevantMemoriesInMemdir } from "core/agent/memdir/findRelevantMemories.js";
import { scanMemoryFiles } from "core/agent/memdir/memoryScan.js";
import type { MemoryHeader as SharedMemoryHeader } from "core/agent/memdir/types.js";
import type { ChatCompletionMessageParam } from "openai/resources.mjs";

import { env } from "../env.js";
import { chatCompletionStreamWithBackoff } from "../util/exponentialBackoff.js";
import { logger } from "../util/logger.js";

import { BaseService } from "./BaseService.js";
import type { FeatureFlagsServiceState } from "./FeatureFlagsService.js";
import { serviceContainer } from "./ServiceContainer.js";
import { ModelServiceState, SERVICE_NAMES } from "./types.js";

export interface MemoryEntry {
  /** Absolute path to the memory file */
  filePath: string;
  /** Relative path from the memory root */
  filename: string;
  /** File name without extension */
  name: string;
  /** Last modification time */
  mtime: Date;
  /** Optional frontmatter description */
  description?: string | null;
  /** Optional frontmatter memory type */
  type?: string | null;
  /** Cached content (lazy-loaded) */
  content?: string;
}

export interface RelevantMemory {
  filePath: string;
  filename: string;
  name: string;
  content: string;
  score: number;
  description?: string | null;
  type?: string | null;
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
const MEMORY_SELECTOR_TIMEOUT_MS = 15000;

const MEMORY_SELECTOR_SYSTEM_PROMPT = `You are selecting memory files that should be injected into the active coding session.

You will be given:
- the active user query
- a manifest of available memory files

Return JSON in this exact shape:
{"selected_memories":["relative/path/to/file.md"]}

Rules:
- Select at most 5 files.
- Only select files that are clearly helpful.
- Prefer warnings, constraints, decisions, and project-specific implementation notes.
- If nothing is clearly helpful, return an empty list.
`;

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
function tryParseSelectedMemories(raw: string): string[] | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const candidate = trimmed.match(/\{[\s\S]*\}/)?.[0] ?? trimmed;

  try {
    const parsed = JSON.parse(candidate) as { selected_memories?: unknown };
    if (!Array.isArray(parsed.selected_memories)) {
      return null;
    }

    return parsed.selected_memories.filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    );
  } catch {
    return null;
  }
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

  private isSemanticSelectionEnabled(): boolean {
    const flags = serviceContainer.getSync<FeatureFlagsServiceState>(
      SERVICE_NAMES.FEATURE_FLAGS,
    ).value;

    return flags?.flags?.SEMANTIC_MEMORY_SELECTION ?? false;
  }

  private async selectMemoriesWithModel(
    query: string,
    headers: readonly SharedMemoryHeader[],
  ): Promise<string[] | null> {
    if (!this.isSemanticSelectionEnabled()) {
      return null;
    }

    const modelState = serviceContainer.getSync<ModelServiceState>(
      SERVICE_NAMES.MODEL,
    ).value;

    if (!modelState?.llmApi || !modelState.model?.model) {
      return null;
    }

    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: MEMORY_SELECTOR_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Query: ${query}\n\nAvailable memories:\n${headers
          .map((header) => {
            const parts = [];
            if (header.type) {
              parts.push(`[${header.type}]`);
            }
            parts.push(header.filename);
            if (header.description) {
              parts.push(`- ${header.description}`);
            }
            return parts.join(" ");
          })
          .join("\n")}`,
      },
    ];

    const abortController = new AbortController();
    const timeout = setTimeout(
      () => abortController.abort(),
      MEMORY_SELECTOR_TIMEOUT_MS,
    );

    let response = "";
    try {
      const stream = await chatCompletionStreamWithBackoff(
        modelState.llmApi,
        {
          model: modelState.model.model,
          messages,
          stream: true as const,
          max_tokens: 256,
        },
        abortController.signal,
      );

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          response += delta;
        }
      }
    } catch (err) {
      logger.debug("MemoryService: semantic selector failed, falling back", {
        error: String(err),
      });
      return null;
    } finally {
      clearTimeout(timeout);
    }

    return tryParseSelectedMemories(response);
  }

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
      const entries: MemoryEntry[] = (await scanMemoryFiles(memoryDir))
        .slice(0, MAX_MEMORY_FILES)
        .map((entry) => ({
          filePath: entry.filePath,
          filename: entry.filename,
          name: entry.name,
          mtime: new Date(entry.mtimeMs),
          description: entry.description,
          type: entry.type,
        }));

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

    const headers: SharedMemoryHeader[] = this.currentState.entries.map(
      (entry) => ({
        filePath: entry.filePath,
        filename: entry.filename,
        name: entry.name,
        mtimeMs: entry.mtime.getTime(),
        description: entry.description ?? null,
        type: entry.type ?? null,
      }),
    );

    const selections = await findRelevantMemoriesInMemdir({
      query,
      memoryDir: this.currentState.memoryDir,
      headers,
      alreadySurfaced,
      maxResults: MAX_INJECTED_MEMORIES,
      selector: async ({ headers }) =>
        this.selectMemoriesWithModel(query, headers),
    });

    const relevant: RelevantMemory[] = [];

    for (const selection of selections) {
      try {
        const raw = await fsPromises.readFile(selection.filePath, "utf8");
        const { markdown } = parseMarkdownRule(raw);
        const content = truncateMemory(markdown || raw);
        relevant.push({
          filePath: selection.filePath,
          filename: selection.filename,
          name: selection.name,
          content,
          score: selection.score,
          description: selection.description,
          type: selection.type,
        });
      } catch (err) {
        logger.warn(`MemoryService: could not read ${selection.filePath}`, {
          err,
        });
      }
    }

    return relevant;
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

    const blocks = memories.map((memory) => {
      const header = [memory.name];
      if (memory.type) {
        header.push(`(${memory.type})`);
      }
      if (memory.description) {
        header.push(`- ${memory.description}`);
      }

      return `### Memory: ${header.join(" ")}\n\n${memory.content}`;
    });

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
