import * as os from "node:os";
import { cleanPath } from "./names";

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
export type ProtectedKind = "secret" | "config";

export interface ProtectedHit {
  kind: ProtectedKind;
  /** The path as it was matched, for the message. */
  path: string;
}

const HOME_SECRET_DIRS = new Set([".ssh", ".aws", ".gnupg", ".kube"]);
const SECRET_BASENAMES = new Set([
  ".netrc",
  ".npmrc",
  ".pypirc",
  "id_rsa",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
]);
const ENV_TEMPLATE = /\.(example|sample|template|dist|defaults)$/i;
const STARTUP_FILES = new Set([
  ".bashrc",
  ".bash_profile",
  ".bash_login",
  ".profile",
  ".zshrc",
  ".zshenv",
  ".zprofile",
  ".zlogin",
]);
const CONFIG_DIRS = new Set([".git", ".continue", ".vscode"]);

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

function segmentsOf(p: string): string[] {
  return p.split("/").filter((s) => s !== "" && s !== ".");
}

function isSecret(p: string): boolean {
  const segs = segmentsOf(p);
  if (segs.length === 0) return false;
  const base = segs[segs.length - 1].toLowerCase();
  if (/^\.env(\..+)?$/.test(base) && !ENV_TEMPLATE.test(base)) return true;
  if (SECRET_BASENAMES.has(base)) return true;
  // ~/.ssh, ~/.aws, ... : the directory itself or anything under it.
  return (
    segs[0] === "~" &&
    segs.length > 1 &&
    HOME_SECRET_DIRS.has(segs[1].toLowerCase())
  );
}

function isConfig(p: string): boolean {
  const segs = segmentsOf(p).map((s) => s.toLowerCase());
  if (segs.some((s) => CONFIG_DIRS.has(s))) return true;
  for (let i = 0; i + 1 < segs.length; i++) {
    if (segs[i] === ".github" && segs[i + 1] === "workflows") return true;
  }
  return segs.length > 0 && STARTUP_FILES.has(segs[segs.length - 1]);
}

/** Check one path. `kinds` says which lists apply to this kind of access. */
export function protectedPathHit(
  raw: string | undefined,
  kinds: ProtectedKind[],
  home: string = os.homedir(),
): ProtectedHit | undefined {
  if (!raw) return undefined;
  const path = normalizeProtectedPath(raw, home);
  if (kinds.includes("secret") && isSecret(path)) {
    return { kind: "secret", path };
  }
  if (kinds.includes("config") && isConfig(path)) {
    return { kind: "config", path };
  }
  return undefined;
}

/** One line for the prompt. */
export function protectedReason(hit: ProtectedHit): string {
  return hit.kind === "secret"
    ? `This touches ${hit.path}, which can hold credentials, so it always asks first.`
    : `This touches ${hit.path}, which can change what runs later, so it always asks first.`;
}
