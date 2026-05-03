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
  minimumMessageTokensToInit: 10_000,
  minimumTokensBetweenUpdate: 5_000,
  toolCallsBetweenUpdates: 3,
  sessionDir: path.join(
    process.env["CONTINUE_SESSION_DIR"] ??
      (process.env["TMPDIR"] ?? "/tmp") + "/continue-sessions",
  ),
};

// ─── Template ─────────────────────────────────────────────────────────────────

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
  if (state.extracting) return false;

  const currentTokens = estimateTokens(messages);

  if (!state.initialized) {
    if (currentTokens < state.config.minimumMessageTokensToInit) return false;
  }

  const tokenGrowth = currentTokens - state.tokensAtLastExtraction;
  if (tokenGrowth < state.config.minimumTokensBetweenUpdate) return false;

  const toolCallsSince = countToolCallsSince(
    messages,
    state.lastExtractedMessageIndex,
  );
  // Require BOTH token growth AND tool call threshold
  return toolCallsSince >= state.config.toolCallsBetweenUpdates;
}

// ─── Notes file management ────────────────────────────────────────────────────

async function ensureNotesFile(notesPath: string): Promise<string> {
  const dir = path.dirname(notesPath);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  try {
    return await fs.readFile(notesPath, "utf-8");
  } catch {
    await fs.writeFile(notesPath, SESSION_MEMORY_TEMPLATE, {
      encoding: "utf-8",
      mode: 0o600,
    });
    return SESSION_MEMORY_TEMPLATE;
  }
}

// ─── Extraction prompt ────────────────────────────────────────────────────────

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
- Write the updated file using the edit_existing_file or create_new_file tool.
- After writing, stop immediately. Do not respond with anything else.`;
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
        await fs.writeFile(state.notesPath, stripped, {
          encoding: "utf-8",
          mode: 0o600,
        });
      }
    } catch {
      // Extraction failure is non-fatal — agent continues regardless
    }
  })();

  return { ...updatedState, extracting: false };
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
    return content.trim() === SESSION_MEMORY_TEMPLATE.trim() ? null : content;
  } catch {
    return null;
  }
}
