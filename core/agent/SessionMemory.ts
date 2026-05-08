/**
 * SessionMemory — ported and adapted from Marcel (Yuto Code) services/SessionMemory/.
 *
 * Maintains a structured markdown notes file for the current agent session.
 * After every N tool calls (and once enough tokens have been exchanged), a
 * background LLM call updates the notes file with the latest session state.
 *
 * The notes file is read back into the agent's system prompt on subsequent
 * sessions (call site responsibility) to provide continuity.
 */

import * as fs from "fs/promises";
import * as path from "path";
import { ChatMessage, ILLM } from "..";
import { stripMarkdownFrontmatter } from "./memoryLifecycle/markdown.js";
import {
  buildSessionMemoryExtractionPrompt,
  buildSessionMemoryFile,
  DEFAULT_SESSION_MEMORY_THRESHOLDS,
  ensureSessionMemoryFile,
  SESSION_MEMORY_TEMPLATE,
  shouldExtractSessionMemoryGate,
} from "./memoryLifecycle/sessionMemory.js";

// ─── Configuration ────────────────────────────────────────────────────────────

export interface SessionMemoryConfig {
  /** Min tokens in history before first extraction (default 10 000) */
  minimumMessageTokensToInit: number;
  /** Min token growth since last extraction before updating (default 5 000) */
  minimumTokensBetweenUpdate: number;
  /** Min tool calls since last extraction before triggering (default 3) */
  toolCallsBetweenUpdates: number;
  /** Directory to write session memory files (default: os.tmpdir/continue-sessions) */
  sessionDir: string;
}

const DEFAULT_CONFIG: SessionMemoryConfig = {
  ...DEFAULT_SESSION_MEMORY_THRESHOLDS,
  sessionDir: path.join(
    process.env["CONTINUE_SESSION_DIR"] ??
      (process.env["TMPDIR"] ?? "/tmp") + "/continue-sessions",
  ),
};

// ─── State ────────────────────────────────────────────────────────────────────

export interface SessionMemoryState {
  sessionId: string;
  notesPath: string;
  config: SessionMemoryConfig;
  /** Message ID of the last turn that was extracted */
  lastExtractedMessageIndex: number;
  /** Token count at the time of last extraction */
  tokensAtLastExtraction: number;
  /** Whether the initialization threshold has been met */
  initialized: boolean;
  /** Whether an extraction is currently running */
  extracting: boolean;
}

export function createSessionMemoryState(
  sessionId: string,
  configOverrides?: Partial<SessionMemoryConfig>,
): SessionMemoryState {
  const config = { ...DEFAULT_CONFIG, ...configOverrides };
  const notesPath = path.join(config.sessionDir, `${sessionId}.md`);
  return {
    sessionId,
    notesPath,
    config,
    lastExtractedMessageIndex: 0,
    tokensAtLastExtraction: 0,
    initialized: false,
    extracting: false,
  };
}

// ─── Token estimation ─────────────────────────────────────────────────────────

/** Rough token count estimation: ~4 chars per token */
function estimateTokens(messages: ChatMessage[]): number {
  let chars = 0;
  for (const msg of messages) {
    if (typeof msg.content === "string") {
      chars += msg.content.length;
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if ("text" in part) chars += (part as any).text.length ?? 0;
      }
    }
  }
  return Math.ceil(chars / 4);
}

function countToolCallsSince(
  messages: ChatMessage[],
  sinceIndex: number,
): number {
  let count = 0;
  for (let i = sinceIndex; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === "assistant" && Array.isArray(msg.toolCalls)) {
      count += msg.toolCalls.length;
    }
  }
  return count;
}

// ─── Extraction trigger ───────────────────────────────────────────────────────

export function shouldExtractSessionMemory(
  state: SessionMemoryState,
  messages: ChatMessage[],
): boolean {
  const currentTokens = estimateTokens(messages);
  return shouldExtractSessionMemoryGate({
    extracting: state.extracting,
    initialized: state.initialized,
    currentTokens,
    tokensAtLastExtraction: state.tokensAtLastExtraction,
    toolCallsSinceExtraction: countToolCallsSince(
      messages,
      state.lastExtractedMessageIndex,
    ),
    config: state.config,
  });
}

// ─── Notes file management ────────────────────────────────────────────────────

async function ensureNotesFile(notesPath: string): Promise<string> {
  return ensureSessionMemoryFile(notesPath, {
    sessionId: path.basename(notesPath, path.extname(notesPath)),
    template: SESSION_MEMORY_TEMPLATE,
    source: "continue-core",
  });
}

// ─── Extraction prompt ────────────────────────────────────────────────────────

function buildExtractionPrompt(
  currentNotes: string,
  notesPath: string,
): string {
  return buildSessionMemoryExtractionPrompt(currentNotes, notesPath);
}

// ─── Main extraction function ─────────────────────────────────────────────────

/**
 * Run a background session memory extraction.
 * Fires a single LLM call (non-streaming) with the current messages + an
 * extraction prompt, asks it to produce an updated notes file content,
 * then writes it to disk.
 *
 * This is intentionally simplified vs. Marcel's forked-subagent approach —
 * we do a single non-tool LLM call and parse the output as the new notes content.
 */
export async function extractSessionMemory(
  state: SessionMemoryState,
  messages: ChatMessage[],
  llm: ILLM,
): Promise<SessionMemoryState> {
  if (state.extracting) return state;

  const updatedState: SessionMemoryState = {
    ...state,
    extracting: true,
    initialized: true,
    lastExtractedMessageIndex: messages.length,
    tokensAtLastExtraction: estimateTokens(messages),
  };

  // Run extraction asynchronously — do not block the agent
  void (async () => {
    try {
      const currentNotes = await ensureNotesFile(state.notesPath);
      const extractionPrompt = buildExtractionPrompt(
        currentNotes,
        state.notesPath,
      );

      // Build the extraction conversation: full history + extraction instruction
      const extractionMessages: ChatMessage[] = [
        ...messages,
        { role: "user", content: extractionPrompt },
      ];

      const abortController = new AbortController();
      // 60s timeout for extraction
      const timeout = setTimeout(() => abortController.abort(), 60_000);

      let notesContent = "";
      try {
        const gen = llm.streamChat(extractionMessages, abortController.signal, {
          maxTokens: 4096,
        });
        for await (const chunk of gen) {
          if (typeof chunk.content === "string") {
            notesContent += chunk.content;
          }
        }
      } finally {
        clearTimeout(timeout);
      }

      // The model should return the updated notes file content.
      // Strip any markdown code fences if present.
      const stripped = notesContent
        .replace(/^```(?:markdown)?\n?/, "")
        .replace(/\n?```$/, "")
        .trim();

      if (stripped.length > 100) {
        await fs.writeFile(
          state.notesPath,
          buildSessionMemoryFile({
            sessionId: state.sessionId,
            markdown: stripped,
            updatedAt: Date.now(),
            source: "continue-core",
          }),
          {
            encoding: "utf-8",
            mode: 0o600,
          },
        );
      }
    } catch {
      // Extraction failure is non-fatal — agent continues regardless
    } finally {
      updatedState.extracting = false;
    }
  })();

  return updatedState;
}

// ─── Session memory reader ────────────────────────────────────────────────────

/**
 * Read the session memory file for a given session, if it exists.
 * Returns null if no notes file exists yet.
 */
export async function readSessionMemory(
  sessionId: string,
  configOverrides?: Partial<SessionMemoryConfig>,
): Promise<string | null> {
  const config = { ...DEFAULT_CONFIG, ...configOverrides };
  const notesPath = path.join(config.sessionDir, `${sessionId}.md`);
  try {
    const content = await fs.readFile(notesPath, "utf-8");
    const markdown = stripMarkdownFrontmatter(content);
    return markdown.trim() === SESSION_MEMORY_TEMPLATE.trim() ? null : markdown;
  } catch {
    return null;
  }
}
