import * as fs from "fs/promises";
import * as path from "path";

import {
  stripMarkdownFrontmatter,
  wrapMarkdownWithFrontmatter,
} from "./markdown.js";

export interface SessionMemoryThresholdConfig {
  minimumMessageTokensToInit: number;
  minimumTokensBetweenUpdate: number;
  toolCallsBetweenUpdates: number;
}

export const DEFAULT_SESSION_MEMORY_THRESHOLDS: SessionMemoryThresholdConfig = {
  minimumMessageTokensToInit: 10_000,
  minimumTokensBetweenUpdate: 5_000,
  toolCallsBetweenUpdates: 3,
};

export const SESSION_MEMORY_TEMPLATE = `# Session Title
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

interface SessionMemoryFileOptions {
  sessionId: string;
  markdown: string;
  totalToolCalls?: number;
  updatedAt?: number;
  source?: string;
}

export function buildSessionMemoryFile(
  options: SessionMemoryFileOptions,
): string {
  const updatedAt = options.updatedAt ?? Date.now();
  return wrapMarkdownWithFrontmatter(
    {
      name: `session/${options.sessionId}`,
      description:
        "Per-session working notes extracted from the active agent session.",
      type: "session-memory",
      session_id: options.sessionId,
      updated_at: new Date(updatedAt).toISOString(),
      total_tool_calls: options.totalToolCalls,
      source: options.source ?? "continue",
    },
    options.markdown,
  );
}

export async function ensureSessionMemoryFile(
  notesPath: string,
  options: {
    sessionId: string;
    totalToolCalls?: number;
    source?: string;
    template?: string;
  },
): Promise<string> {
  const template = options.template ?? SESSION_MEMORY_TEMPLATE;
  await fs.mkdir(path.dirname(notesPath), { recursive: true, mode: 0o700 });

  try {
    const existing = await fs.readFile(notesPath, "utf-8");
    return stripMarkdownFrontmatter(existing) || template;
  } catch {
    await fs.writeFile(
      notesPath,
      buildSessionMemoryFile({
        sessionId: options.sessionId,
        markdown: template,
        totalToolCalls: options.totalToolCalls,
        source: options.source,
      }),
      {
        encoding: "utf-8",
        mode: 0o600,
      },
    );
    return template;
  }
}

export function buildSessionMemoryExtractionPrompt(
  currentNotes: string,
  notesPath: string,
): string {
  return `You are a session note-keeper. Based on the conversation above, update the session notes file.

Current notes content:
<current_notes>
${currentNotes}
</current_notes>

Your ONLY task: update the session notes file at \`${notesPath}\` to reflect the latest state of the session. Rules:
- Maintain the EXACT file structure (all section headers and italic description lines must be preserved verbatim).
- Update content within sections only — never modify headers or the italic _description_ lines.
- Be terse. Each section should be densely informative, not verbose.
- Do not add a section for "Session Memory Update" or reference these instructions.
- Return ONLY the updated notes content, no additional commentary.
- After writing, stop immediately.`;
}

export function shouldExtractSessionMemoryGate(args: {
  extracting: boolean;
  initialized: boolean;
  currentTokens: number;
  tokensAtLastExtraction: number;
  toolCallsSinceExtraction: number;
  config?: Partial<SessionMemoryThresholdConfig>;
}): boolean {
  const config = {
    ...DEFAULT_SESSION_MEMORY_THRESHOLDS,
    ...args.config,
  };

  if (args.extracting) return false;

  if (!args.initialized) {
    if (args.currentTokens < config.minimumMessageTokensToInit) return false;
  }

  const tokenGrowth = args.currentTokens - args.tokensAtLastExtraction;
  if (tokenGrowth < config.minimumTokensBetweenUpdate) return false;

  return args.toolCallsSinceExtraction >= config.toolCallsBetweenUpdates;
}
