import { ChildProcess, SpawnOptions } from "child_process";

/**
 * Spawn options for CLI-started shell commands.
 * On Unix, detached:true puts the child in its own process group so we can
 * kill the full descendant tree with process.kill(-pid).
 */
export function getToolSpawnOptions(): SpawnOptions {
  if (process.platform === "win32") {
    return { stdio: "pipe", windowsHide: true };
  }
  return { stdio: "pipe", detached: true };
}

/**
 * Kill a spawned child and, on Unix, its process group (descendants).
 */
export function killProcessTree(
  child: ChildProcess,
  signal: NodeJS.Signals = "SIGTERM",
): void {
  if (!child.pid) {
    try {
      child.kill(signal);
    } catch {
      // ignore
    }
    return;
  }

  if (process.platform === "win32") {
    try {
      child.kill(signal);
    } catch {
      // ignore
    }
    return;
  }

  try {
    process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      // ignore
    }
  }
}
