import * as os from "node:os";
import { cleanPath } from "./names";
import { isConfigPath, isSecretPath } from "./protectedPaths";

/**
 * Paths a tool call should never touch without the user saying yes, whatever
 * the tool's setting or an allow rule says (plans/tool-auto-approval.md,
 * section 5, step 2). A hit makes the call ask. It does not refuse: a person
 * can still approve it. A deny rule is how to refuse.
 *
 * Two lists, because reading `.git/config` is not like reading `~/.aws`:
 * - SECRET paths guard credentials. They apply to every tool and to commands.
 * - CONFIG paths guard things that change what runs later (git hooks, CI,
 *   editor tasks, shell startup). They apply to writes and to commands, since
 *   a command may write; plain file reads and listings of them are fine.
 *
 * Matching ignores case (Windows and macOS volumes do) and slash direction.
 */
export type ProtectedKind = "secret" | "config" | "network";

export interface ProtectedHit {
  kind: ProtectedKind;
  /** The path as it was matched, for the message. */
  path: string;
}

/** Home directory as a forward-slash path, for turning absolute paths into `~/...`. */
export function homeAsPosix(home: string = os.homedir()): string {
  return home.replace(/\\/g, "/").replace(/\/+$/, "");
}

/** Make a path comparable: forward slashes, no `./`, `~` for the home dir, `..` resolved. */
export function normalizeProtectedPath(raw: string, home: string): string {
  let p = raw.trim().replace(/\\/g, "/");
  // A file URI's path is `/C:/Users/...`; drop the slash so it compares as a drive path.
  p = p.replace(/^\/([a-zA-Z]:\/)/, "$1");
  p = p.replace(
    /^(\$HOME|\$\{HOME\}|%USERPROFILE%|\$env:USERPROFILE)(?=\/|$)/i,
    "~",
  );
  const h = homeAsPosix(home);
  if (h && p.toLowerCase().startsWith(h.toLowerCase() + "/")) {
    p = "~" + p.slice(h.length);
  } else if (h && p.toLowerCase() === h.toLowerCase()) {
    p = "~";
  }
  return cleanPath(p);
}

/** Check one path. `kinds` says which lists apply to this kind of access. */
export function protectedPathHit(
  raw: string | undefined,
  kinds: ProtectedKind[],
  home: string = os.homedir(),
): ProtectedHit | undefined {
  if (!raw) return undefined;
  const path = normalizeProtectedPath(raw, home);
  if (kinds.includes("secret") && isSecretPath(path)) {
    return { kind: "secret", path };
  }
  if (kinds.includes("config") && isConfigPath(path)) {
    return { kind: "config", path };
  }
  return undefined;
}

/** One line for the prompt. */
export function protectedReason(hit: ProtectedHit): string {
  if (hit.kind === "network") {
    return `This touches the network path ${hit.path}. Looking it up contacts that computer, and on Windows can send your login to it, so it always asks first.`;
  }
  return hit.kind === "secret"
    ? `This touches ${hit.path}, which can hold credentials, so it always asks first.`
    : `This touches ${hit.path}, which can change what runs later, so it always asks first.`;
}
