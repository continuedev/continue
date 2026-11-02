import { execFile } from "node:child_process";

const FLAG = "--use-system-ca";

/**
 * `NODE_OPTIONS` for a stdio MCP server so that Node-based servers (the usual
 * `npx ...` ones) trust the OS certificate store, like Continue itself does.
 * Without it they fail behind a TLS-inspecting proxy with
 * `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`.
 *
 * Never overrides what the user set: an existing mention of the flag is kept
 * as is, and other options are preserved.
 */
export function withSystemCaNodeOption(
  env: Record<string, string>,
  enable: boolean,
  nodeSupportsFlag: boolean,
): Record<string, string> {
  if (!enable || !nodeSupportsFlag) return env;
  const existing = env.NODE_OPTIONS ?? "";
  if (existing.includes(FLAG)) return env;
  return {
    ...env,
    NODE_OPTIONS: `${existing} ${FLAG}`.trim(),
  };
}

const supportCache = new Map<string, Promise<boolean>>();

/**
 * Does the `node` that this PATH resolves to know `--use-system-ca`? Older
 * versions refuse to start when NODE_OPTIONS contains an unknown flag, which
 * would break the server entirely, so ask before adding it. Cached per PATH.
 */
export function nodeSupportsSystemCa(
  env: Record<string, string | undefined>,
): Promise<boolean> {
  const key = env.PATH ?? env.Path ?? "";
  let result = supportCache.get(key);
  if (!result) {
    result = new Promise<boolean>((resolve) => {
      execFile(
        "node",
        [FLAG, "-e", "0"],
        { env: { ...env, NODE_OPTIONS: "" }, timeout: 5000, windowsHide: true },
        (error) => resolve(!error),
      );
    });
    supportCache.set(key, result);
  }
  return result;
}

/** Test hook. */
export function clearSystemCaSupportCache() {
  supportCache.clear();
}
