/**
 * What a configuration file that came with the repository may not do
 * (plans/policy-areas.md, "Settings"): add allow rules, or tell the
 * reviewer what is fine to allow or which domains to trust. Those loosen
 * what runs without asking, and a checked-in file is the attacker's
 * channel: CVE-2025-53773 was a repository turning approvals off, and
 * Cursor's MCPoison a config trusted after it changed. Deny, ask and
 * exclude from such a file are kept: a repository may only tighten.
 *
 * A trust dialog that lets the person accept a workspace file's allow rules,
 * keyed to the file's content, is the planned next step; until then the
 * keys are dropped with a notice naming them.
 */

/** The keys under `toolPermissions` a repository file may not set. */
export const UNTRUSTED_LOOSENING_KEYS: readonly string[] = [
  "toolPermissions.allow",
  "toolPermissions.auto.guidance.allow",
  "toolPermissions.auto.environment.trustedDomains",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Deletes `path` (dot-separated) from `obj` if present; true when it was. */
function deleteAt(obj: Record<string, unknown>, path: string[]): boolean {
  const [head, ...rest] = path;
  if (!(head in obj)) return false;
  if (rest.length === 0) {
    delete obj[head];
    return true;
  }
  const child = obj[head];
  if (!isRecord(child)) return false;
  const removed = deleteAt(child, rest);
  if (removed && Object.keys(child).length === 0) delete obj[head];
  return removed;
}

export interface StrippedConfig<T> {
  config: T;
  /** The keys that were present and removed, as dot paths. */
  removed: string[];
}

/**
 * A copy of a parsed configuration (a YAML block or a whole config) with the
 * loosening keys a repository may not set removed. Nothing else changes.
 */
export function stripUntrustedLoosening<T>(raw: T): StrippedConfig<T> {
  if (!isRecord(raw)) return { config: raw, removed: [] };
  const copy = structuredClone(raw) as Record<string, unknown>;
  const removed: string[] = [];
  for (const key of UNTRUSTED_LOOSENING_KEYS) {
    if (deleteAt(copy, key.split("."))) removed.push(key);
  }
  return { config: copy as T, removed };
}

/** The notice shown when a workspace file's loosening keys were ignored. */
export function untrustedLooseningNotice(
  file: string,
  removed: string[],
): string {
  return `${file} came with the workspace, so ${removed.join(", ")} in it ${removed.length === 1 ? "was" : "were"} ignored: a repository file can add deny and ask rules but not allow rules or reviewer guidance. Move them to your own config to use them.`;
}
