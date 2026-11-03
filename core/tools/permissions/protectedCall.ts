import * as os from "node:os";
import { parseCommand, ruleCandidates } from "./command";
import { ProtectedHit, ProtectedKind, protectedPathHit } from "./protected";

/** The words of a command worth testing as paths: quotes, redirects and `--opt=` stripped. */
function pathWords(command: string): string[] {
  const words = new Set<string>();
  for (const part of parseCommand(command).parts) {
    for (const candidate of ruleCandidates(part)) {
      for (const raw of candidate.split(" ")) {
        const w = raw.replace(/^[<>&|]+/, "").replace(/^['"]+|['"]+$/g, "");
        if (!w) continue;
        words.add(w);
        const eq = w.indexOf("=");
        if (eq > 0 && eq < w.length - 1) {
          words.add(w.slice(eq + 1).replace(/^['"]+|['"]+$/g, ""));
        }
      }
    }
  }
  return [...words];
}

/**
 * Does a command mention a protected path anywhere in its words? Over-matches
 * on purpose, like deny rules: `echo .env` asks. A command can use a path in
 * ways this cannot see (a variable, a glob, `cd` then a bare name), so this
 * is a guard against accidents, not a sandbox.
 */
export function protectedCommandHit(
  command: string,
  home: string = os.homedir(),
): ProtectedHit | undefined {
  for (const word of pathWords(command)) {
    const hit = protectedPathHit(word, ["secret", "config"], home);
    if (hit) return hit;
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
