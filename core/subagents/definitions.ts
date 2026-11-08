import { parseMarkdownRule } from "@continuedev/config-yaml";
import { BuiltInToolNames } from "../tools/builtIn";

/** Where a subagent definition came from, highest precedence first. */
export type SubagentSource =
  | "workspace-continue"
  | "workspace-claude"
  | "user-continue"
  | "user-claude"
  | "built-in";

/**
 * A subagent: a system prompt, a tool allow-list and a model, run in a fresh
 * conversation that reports back once. The file format is the one Claude Code
 * uses for `.claude/agents/*.md`, so those files load unchanged.
 */
export interface SubagentDefinition {
  name: string;
  description: string;
  /** The agent's system prompt: the Markdown body of the file. */
  prompt: string;
  /**
   * The tools it may use, as written (`Read, Grep`, `read_file`, `mcp__x__y`).
   * Undefined means every tool the parent has, still minus the ones subagents
   * never get.
   */
  tools?: string[];
  /** Tools removed from whatever `tools` allows. */
  disallowedTools?: string[];
  /** A model alias, title or id; undefined or `inherit` means the chat model. */
  model?: string;
  /** The most model calls the run may make before it stops as partial. */
  maxTurns?: number;
  source: SubagentSource;
  /** The file it was read from; absent for built-in agents. */
  path?: string;
}

/** Model calls a run may make when its definition does not say. */
export const DEFAULT_SUBAGENT_MAX_TURNS = 30;

/**
 * The built-in read-only explorer. Search and read tools only: no terminal,
 * no edits, no web, so it can run without asking and in parallel.
 */
export const EXPLORE_AGENT: SubagentDefinition = {
  name: "Explore",
  description:
    "Fast read-only search of the codebase. Use it to find files, symbols and usages, or to answer a question that needs many files read, when only the conclusion matters. Say how thorough to be.",
  prompt: `You are Explore, a read-only search agent. Find what the task asks for and report it.

- Use the search and read tools, and code_navigation (definitions, references, outlines) where it is available. You cannot edit files or run commands.
- Search broadly first, then read only the parts that matter.
- Your final message is the only thing the caller sees. Make it a self-contained report: the answer, the file paths (with line numbers where useful) and anything you could not find. Do not paste whole files.`,
  tools: [
    BuiltInToolNames.ReadFile,
    BuiltInToolNames.ReadFileRange,
    BuiltInToolNames.ReadCurrentlyOpenFile,
    BuiltInToolNames.GrepSearch,
    BuiltInToolNames.FileGlobSearch,
    BuiltInToolNames.LSTool,
    BuiltInToolNames.ViewSubdirectory,
    BuiltInToolNames.ViewRepoMap,
    BuiltInToolNames.CodebaseTool,
    BuiltInToolNames.ViewDiff,
    BuiltInToolNames.CodeNavigation,
  ],
  source: "built-in",
};

export const BUILT_IN_SUBAGENTS: SubagentDefinition[] = [EXPLORE_AGENT];

/** A comma-separated string or a YAML list, as Claude Code accepts both. */
function toList(value: unknown, field: string): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value.map((v) => {
      if (typeof v !== "string") {
        throw new Error(`"${field}" entries must be strings`);
      }
      return v.trim();
    });
  }
  throw new Error(`"${field}" must be a comma-separated string or a list`);
}

/** The file name without directories or `.md`, for agents with no `name`. */
function baseName(path: string): string {
  const file = path.split(/[\\/]/).pop() ?? path;
  return file.replace(/\.md$/i, "");
}

/**
 * Parse one agent file. Only `name` (defaulting to the file name) and
 * `description` are required; unknown fields are ignored, as Claude Code does,
 * so files written for it load here.
 */
export function parseSubagentFile(
  content: string,
  path: string,
  source: SubagentSource,
): SubagentDefinition {
  const { frontmatter, markdown } = parseMarkdownRule(content) as unknown as {
    frontmatter: Record<string, unknown>;
    markdown: string;
  };

  const rawName = frontmatter.name ?? baseName(path);
  if (typeof rawName !== "string" || !rawName.trim()) {
    throw new Error(`"name" must be a non-empty string`);
  }
  const name = rawName.trim();
  if (!/^[\w.-]+$/.test(name)) {
    throw new Error(
      `"name" may only contain letters, digits, ".", "_" and "-" (got "${name}")`,
    );
  }

  const description = frontmatter.description;
  if (typeof description !== "string" || !description.trim()) {
    throw new Error(`"description" is required`);
  }

  const model = frontmatter.model;
  if (model !== undefined && typeof model !== "string") {
    throw new Error(`"model" must be a string`);
  }

  const maxTurns = frontmatter.maxTurns;
  if (
    maxTurns !== undefined &&
    (typeof maxTurns !== "number" ||
      !Number.isInteger(maxTurns) ||
      maxTurns < 1)
  ) {
    throw new Error(`"maxTurns" must be a positive integer`);
  }

  return {
    name,
    description: description.trim(),
    prompt: markdown.trim(),
    tools: toList(frontmatter.tools, "tools"),
    disallowedTools: toList(frontmatter.disallowedTools, "disallowedTools"),
    model: model?.trim() || undefined,
    ...(maxTurns !== undefined && { maxTurns: maxTurns as number }),
    source,
    path,
  };
}

/**
 * One list from definitions given highest precedence first: the first agent
 * with a name wins (names compare case-insensitively), so a workspace file
 * overrides a user file and either can replace a built-in agent.
 */
export function mergeSubagentDefinitions(
  groups: SubagentDefinition[][],
): SubagentDefinition[] {
  const seen = new Set<string>();
  const merged: SubagentDefinition[] = [];
  for (const group of groups) {
    for (const def of group) {
      const key = def.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(def);
    }
  }
  return merged;
}

export function findSubagent(
  agents: SubagentDefinition[],
  name: string,
): SubagentDefinition | undefined {
  const key = name.trim().toLowerCase();
  return agents.find((a) => a.name.toLowerCase() === key);
}
