import { ConfigValidationError } from "@continuedev/config-yaml";
import { BuiltInToolNames } from "../builtIn";
import { mcpServerSlug } from "../mcpToolName";
import {
  ParsedRule,
  parseRule,
  parseToolPermissions,
  RuleDecision,
  ToolPermissions,
} from "./rules";

/** Parsed rules, or none when the user has not set any. */
export function parsePermissions(
  perms: ToolPermissions | undefined,
): ParsedRule[] {
  return perms ? parseToolPermissions(perms) : [];
}

/** A file:// URI as a plain path with forward slashes, or undefined if it is not one. */
export function uriToPath(uri: string | undefined): string | undefined {
  if (!uri) return undefined;
  try {
    const url = new URL(uri);
    if (url.protocol !== "file:") return undefined;
    return decodeURIComponent(url.pathname);
  } catch {
    return undefined;
  }
}

/**
 * Rules use readable names (`runTerminalCommand`, `readFile`, `writeFile`);
 * the tools the model calls use snake_case. Several tools share one rule name
 * so one rule covers them: `readFile` covers read_file and read_file_range.
 * A rule may also use the snake_case name directly.
 */
const RULE_NAME: Record<string, string> = {
  [BuiltInToolNames.RunTerminalCommand]: "runTerminalCommand",
  [BuiltInToolNames.ReadFile]: "readFile",
  [BuiltInToolNames.ReadFileRange]: "readFile",
  [BuiltInToolNames.ReadCurrentlyOpenFile]: "readFile",
  [BuiltInToolNames.CreateNewFile]: "writeFile",
  [BuiltInToolNames.EditExistingFile]: "writeFile",
  [BuiltInToolNames.SingleFindAndReplace]: "writeFile",
  [BuiltInToolNames.MultiEdit]: "writeFile",
  [BuiltInToolNames.LSTool]: "listDirectory",
  [BuiltInToolNames.ViewSubdirectory]: "listDirectory",
  [BuiltInToolNames.GrepSearch]: "grepSearch",
  [BuiltInToolNames.FileGlobSearch]: "globSearch",
  [BuiltInToolNames.FetchUrlContent]: "fetchUrl",
  [BuiltInToolNames.SearchWeb]: "searchWeb",
};

/** The name rules use for a tool call. Unknown tools keep their own name. */
export function canonicalRuleName(toolName: string): string {
  return RULE_NAME[toolName] ?? toolName;
}

/** The rule name of an MCP tool: `mcp__<server>__<tool>`, e.g. mcp__datadog__query. */
export function mcpRuleName(serverName: string, toolName: string): string {
  return `mcp__${mcpServerSlug(serverName)}__${toolName}`;
}

/** Forward slashes and no leading `./`, so a rule glob behaves the same everywhere. */
export function normalizeRelative(p: string | undefined): string | undefined {
  if (p === undefined) return undefined;
  let out = p.trim().replace(/\\/g, "/");
  while (out.startsWith("./")) out = out.slice(2);
  return out;
}

/**
 * The strings a rule pattern is matched against for a call. File tools give
 * both the path as the model wrote it and the resolved absolute path (when
 * known), so `readFile(**\/.env)` catches `~/proj/.env` and `../x/.env` alike.
 */
export function ruleTargetsFor(
  toolName: string,
  args: Record<string, unknown>,
  resolvedPath?: string,
): string[] {
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const paths = (...raw: (string | undefined)[]) =>
    [...raw, resolvedPath]
      .map(normalizeRelative)
      .filter((p, i, all): p is string => !!p && all.indexOf(p) === i);

  switch (toolName) {
    case BuiltInToolNames.RunTerminalCommand:
      return str(args.command) ? [args.command as string] : [];
    case BuiltInToolNames.ReadFile:
    case BuiltInToolNames.ReadFileRange:
    case BuiltInToolNames.CreateNewFile:
    case BuiltInToolNames.EditExistingFile:
    case BuiltInToolNames.SingleFindAndReplace:
    case BuiltInToolNames.MultiEdit:
      return paths(str(args.filepath));
    case BuiltInToolNames.LSTool:
      return paths(str(args.dirPath) ?? ".");
    case BuiltInToolNames.ViewSubdirectory:
      return paths(str(args.directory_path));
    case BuiltInToolNames.FetchUrlContent:
      return str(args.url) ? [args.url as string] : [];
    case BuiltInToolNames.GrepSearch:
    case BuiltInToolNames.SearchWeb:
      return str(args.query) ? [args.query as string] : [];
    case BuiltInToolNames.FileGlobSearch:
      return str(args.pattern) ? [args.pattern as string] : [];
    default:
      return [];
  }
}

const KNOWN_NAMES = new Set([
  ...Object.keys(RULE_NAME),
  ...Object.values(RULE_NAME),
  ...Object.values(BuiltInToolNames),
]);

/**
 * Problems with the rules in config.yaml, as non-fatal config errors. A rule
 * that fails to parse is skipped, so a mistyped *deny* rule would otherwise
 * protect nothing without saying so.
 */
export function validateToolPermissions(
  perms: ToolPermissions | undefined,
): ConfigValidationError[] {
  const errors: ConfigValidationError[] = [];
  if (!perms) return errors;
  for (const kind of ["allow", "ask", "deny"] as RuleDecision[]) {
    (perms[kind] ?? []).forEach((raw, i) => {
      const where = `toolPermissions.${kind}[${i}]`;
      const rule = parseRule(raw, kind);
      if (!rule) {
        errors.push({
          fatal: false,
          message: `${where}: cannot read the rule "${raw}". Write it as toolName(pattern) or just toolName. The rule is ignored.`,
        });
      } else if (
        !KNOWN_NAMES.has(rule.toolName) &&
        !rule.toolName.startsWith("mcp__")
      ) {
        errors.push({
          fatal: false,
          message: `${where}: "${rule.toolName}" is not a tool name this version knows (try runTerminalCommand, readFile, writeFile, listDirectory, fetchUrl or mcp__server__tool). The rule will not match anything unless a tool has that exact name.`,
        });
      }
    });
  }
  return errors;
}
