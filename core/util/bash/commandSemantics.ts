import { extractOutputRedirections } from "./commands";

export type CommandRiskLevel = "read_only" | "mixed" | "write" | "destructive";

const READ_ONLY_COMMANDS = new Set([
  "cat",
  "cd",
  "echo",
  "find",
  "git",
  "grep",
  "head",
  "history",
  "ls",
  "nl",
  "pwd",
  "rg",
  "tail",
  "tree",
  "which",
  "whoami",
  "wc",
]);

function firstCommandToken(command: string): string {
  return command.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
}

function hasDestructivePattern(command: string): boolean {
  const normalized = command.toLowerCase();
  if (
    /\brm\b/.test(normalized) &&
    /\s-(?:[^\s]*r[^\s]*f|[^\s]*f[^\s]*r)/.test(normalized)
  ) {
    return true;
  }
  if (/\bmkfs(\.\w+)?\b/.test(normalized)) {
    return true;
  }
  if (/\b(dd|format)\b/.test(normalized)) {
    return true;
  }
  if (
    /\b(chmod|chown)\b/.test(normalized) &&
    /\b(777|root)\b/.test(normalized)
  ) {
    return true;
  }
  return false;
}

function hasWriteIntent(command: string): boolean {
  const normalized = command.toLowerCase();

  if (
    /\b(sed\s+-i|perl\s+-i|tee|truncate|touch|mv|cp|mkdir|rmdir|rm)\b/.test(
      normalized,
    )
  ) {
    return true;
  }

  const { redirections, hasDangerousRedirection } =
    extractOutputRedirections(command);
  if (hasDangerousRedirection || redirections.length > 0) {
    return true;
  }

  return false;
}

export function classifyCommandRisk(command: string): CommandRiskLevel {
  if (hasDestructivePattern(command)) {
    return "destructive";
  }

  const token = firstCommandToken(command);
  const writeIntent = hasWriteIntent(command);

  if (!writeIntent && READ_ONLY_COMMANDS.has(token)) {
    return "read_only";
  }

  if (writeIntent) {
    return "write";
  }

  return "mixed";
}
