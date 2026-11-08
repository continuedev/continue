import * as os from "node:os";
import * as path from "node:path";
import { IDE } from "..";
import { walkDir } from "../indexing/walkDir";
import { localPathToUri } from "../util/pathToUri";
import { getGlobalFolderWithName } from "../util/paths";
import { joinPathsToUri } from "../util/uri";
import {
  BUILT_IN_SUBAGENTS,
  mergeSubagentDefinitions,
  parseSubagentFile,
  SubagentDefinition,
  SubagentSource,
} from "./definitions";
import { WORKSPACE_DIRS } from "../util/workspaceDirs";

export interface SubagentLoadResult {
  agents: SubagentDefinition[];
  /** One line per file that could not be read or parsed. */
  errors: string[];
}

const AGENTS_DIR = "agents";

/**
 * The directories agent files are read from, highest precedence first:
 * the workspace's `.continuous/agents`, its `.claude/agents` (Claude Code's
 * location, read for compatibility), then the same two in the user's home.
 *
 * `.continuous/agents` also holds YAML agent configs (profiles); only its
 * Markdown files are subagents.
 */
export async function subagentDirs(
  ide: IDE,
  home = os.homedir(),
): Promise<{ dir: string; source: SubagentSource }[]> {
  const workspaceDirs = await ide.getWorkspaceDirs();
  return [
    ...workspaceDirs.flatMap((dir) =>
      WORKSPACE_DIRS.map((name) => ({
        dir: joinPathsToUri(dir, name, AGENTS_DIR),
        source: "workspace-continue" as const,
      })),
    ),
    ...workspaceDirs.map((dir) => ({
      dir: joinPathsToUri(dir, ".claude", AGENTS_DIR),
      source: "workspace-claude" as const,
    })),
    {
      dir: localPathToUri(getGlobalFolderWithName(AGENTS_DIR)),
      source: "user-continue" as const,
    },
    {
      dir: localPathToUri(path.join(home, ".claude", AGENTS_DIR)),
      source: "user-claude" as const,
    },
  ];
}

/**
 * Every subagent the workspace and user define, then the built-in ones. Read
 * fresh on each call, so an edit to an agent file applies to the next run
 * without a config reload.
 */
export async function loadSubagentDefinitions(
  ide: IDE,
  home?: string,
): Promise<SubagentLoadResult> {
  const errors: string[] = [];
  const dirs = await subagentDirs(ide, home);

  const groups = await Promise.all(
    dirs.map(async ({ dir, source }) => {
      const found: SubagentDefinition[] = [];
      try {
        if (!(await ide.fileExists(dir))) return found;
        const uris = (
          await walkDir(dir, ide, { source: "get subagent definitions" })
        )
          .filter((uri) => uri.toLowerCase().endsWith(".md"))
          .sort();
        for (const uri of uris) {
          try {
            const content = await ide.readFile(uri);
            found.push(parseSubagentFile(content, uri, source));
          } catch (e) {
            errors.push(
              `${uri}: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        }
      } catch (e) {
        errors.push(`${dir}: ${e instanceof Error ? e.message : String(e)}`);
      }
      return found;
    }),
  );

  return {
    agents: mergeSubagentDefinitions([...groups, BUILT_IN_SUBAGENTS]),
    errors,
  };
}
