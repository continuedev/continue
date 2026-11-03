import * as os from "node:os";
import { commandCandidates } from "./candidates";
import { ProtectedHit, ProtectedKind, protectedPathHit } from "./protected";
import { isNetworkPath, secretWordLabel } from "./secretCommands";

const strip = (s: string) =>
  s.replace(/^[<>&|]+/, "").replace(/^['"]+|['"]+$/g, "");

/** Words of a command, per candidate, so a command name knows whether it has arguments. */
function candidateWords(command: string): string[][] {
  return commandCandidates(command).map((c) =>
    c.split(/\s+/).map(strip).filter(Boolean),
  );
}

/** The words of a command worth testing as paths: quotes, redirects and `--opt=` stripped. */
function pathWords(command: string): string[] {
  const words = new Set<string>();
  for (const list of candidateWords(command)) {
    for (const w of list) {
      words.add(w);
      const eq = w.indexOf("=");
      if (eq > 0 && eq < w.length - 1) words.add(strip(w.slice(eq + 1)));
    }
  }
  return [...words];
}

/**
 * Does a command mention a protected path anywhere in its words? Over-matches
 * on purpose, like deny rules: `echo .env` asks. A command can use a path in
 * ways this cannot see (a variable, a glob, `cd` then a bare name), so this
 * is a guard against accidents, not a sandbox.
 *
 * It also catches commands that print credentials without naming a file
 * (`printenv`, `echo $AWS_SECRET_ACCESS_KEY`, `dir env:`) and network paths
 * (`\\host\share`), which contact another computer.
 */
export function protectedCommandHit(
  command: string,
  home: string = os.homedir(),
): ProtectedHit | undefined {
  for (const word of pathWords(command)) {
    const hit = protectedPathHit(word, ["secret", "config"], home);
    if (hit) return hit;
  }
  for (const word of command.split(/\s+/)) {
    if (isNetworkPath(word)) {
      return { kind: "network", path: strip(word) };
    }
  }
  for (const words of candidateWords(command)) {
    for (let i = 0; i < words.length; i++) {
      const label = secretWordLabel(
        words[i],
        i === 0,
        words.length > 1,
        i > 0 ? words[i - 1] : undefined,
      );
      if (label) return { kind: "secret", path: label };
    }
  }
  return undefined;
}

const READ_TOOLS = new Set([
  "read_file",
  "read_file_range",
  "read_currently_open_file",
]);
const LIST_TOOLS = new Set(["ls", "view_subdirectory"]);
const WRITE_TOOLS = new Set([
  "create_new_file",
  "edit_existing_file",
  "single_find_and_replace",
  "multi_edit",
]);

/** Does this tool call touch a protected path? Checks the written path and the resolved one. */
export function findProtected(args: {
  toolName: string;
  parsedArgs: Record<string, unknown>;
  resolvedPath?: string;
  home?: string;
}): ProtectedHit | undefined {
  const { toolName, parsedArgs, resolvedPath } = args;
  const home = args.home ?? os.homedir();
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);

  if (toolName === "run_terminal_command") {
    const command = str(parsedArgs.command);
    return command ? protectedCommandHit(command, home) : undefined;
  }

  let kinds: ProtectedKind[];
  let written: string | undefined;
  if (READ_TOOLS.has(toolName)) {
    kinds = ["secret"];
    written = str(parsedArgs.filepath);
  } else if (LIST_TOOLS.has(toolName)) {
    kinds = ["secret"];
    written = str(parsedArgs.dirPath) ?? str(parsedArgs.directory_path);
  } else if (WRITE_TOOLS.has(toolName)) {
    kinds = ["secret", "config"];
    written = str(parsedArgs.filepath);
  } else {
    return undefined;
  }
  return (
    protectedPathHit(written, kinds, home) ??
    protectedPathHit(resolvedPath, kinds, home)
  );
}
