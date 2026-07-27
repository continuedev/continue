import { homedir } from "os";
import { basename } from "path";

/**
 * Context used to resolve VS Code-style predefined variables in MCP server
 * config values (command/args/cwd/env), e.g. `${workspaceFolder}`.
 */
export interface McpVariableContext {
  /** Absolute filesystem path of the primary workspace folder, if known. */
  workspaceDir?: string;
  /** Environment variables to resolve `${env:VAR}` against. Defaults to process.env. */
  env?: Record<string, string | undefined>;
}

// Only matches known variable names, so anything else (unknown variables,
// or Continue's own `${{ secrets.X }}` template syntax) is left untouched.
const VARIABLE_PATTERN =
  /\$\{(workspaceFolder|workspaceFolderBasename|userHome|env:([^}]+))\}/g;

function resolveToken(
  token: string,
  envVarName: string | undefined,
  context: McpVariableContext,
): string | undefined {
  switch (token) {
    case "workspaceFolder":
      return context.workspaceDir;
    case "workspaceFolderBasename":
      return context.workspaceDir ? basename(context.workspaceDir) : undefined;
    case "userHome":
      return homedir();
    default:
      // token is `env:VAR` here, envVarName is the captured VAR
      return envVarName === undefined
        ? undefined
        : (context.env ?? process.env)[envVarName];
  }
}

function resolveInString(value: string, context: McpVariableContext): string {
  return value.replace(VARIABLE_PATTERN, (match, token, envVarName) => {
    const resolved = resolveToken(token, envVarName, context);
    return resolved ?? match;
  });
}

/**
 * Recursively resolves VS Code-style predefined variables
 * (`${workspaceFolder}`, `${workspaceFolderBasename}`, `${userHome}`,
 * `${env:VAR}`) inside strings, arrays, and plain objects. Unknown variables
 * and unset env vars are left untouched.
 */
export function resolveMcpVariables<T>(
  value: T,
  context: McpVariableContext,
): T {
  if (typeof value === "string") {
    return resolveInString(value, context) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) =>
      resolveMcpVariables(item, context),
    ) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [
        key,
        resolveMcpVariables(val, context),
      ]),
    ) as unknown as T;
  }
  return value;
}
