/**
 * Helpers for deciding how `run_terminal_command` should execute on a given IDE.
 *
 * Kept free of VS Code imports so it can be unit-tested in isolation and reused
 * by both `core` (tool implementation) and `extensions/vscode` (IDE implementation).
 */

/**
 * `vscode.env.remoteName` values for which we can reliably capture terminal output
 * through the integrated terminal.
 *
 * Why these four:
 * - `wsl`         — Windows VS Code + WSL distro. Extension host is local, terminal
 *                   runs in Linux. See .patches/10-wsl-remote-terminal-output-capture.md
 * - `ssh-remote`  — VS Code Remote-SSH. Extension host runs on the SSH server.
 * - `dev-container` — VS Code Dev Containers. Extension host runs inside the container.
 * - `codespaces`  — GitHub Codespaces (a Remote-SSH variant).
 *
 * All four expose a POSIX-ish shell and an authority-scoped `vscode.workspace.fs`,
 * which is what the file-capture strategy relies on. Anything else (including the
 * empty string / `"local"`, which are handled by the local `childProcess.spawn` path,
 * and unknown third-party remotes) falls back to fire-and-forget.
 */
export const OUTPUT_CAPTURE_CAPABLE_REMOTES: readonly string[] = [
  "wsl",
  "ssh-remote",
  "dev-container",
  "codespaces",
];

/**
 * `vscode.env.remoteName` values meaning "no remote — the extension host is the
 * machine the user is working on", so commands can be spawned directly.
 */
export const LOCAL_REMOTE_NAMES: readonly string[] = ["", "local"];

/**
 * Should terminal output be captured for this `remoteName`?
 *
 * Returns `false` for local (handled by `childProcess.spawn`) and for unknown remotes.
 */
export function supportsRemoteTerminalOutput(
  remoteName: string | undefined,
): boolean {
  if (!remoteName) {
    return false;
  }
  return OUTPUT_CAPTURE_CAPABLE_REMOTES.includes(remoteName);
}

/**
 * Is this a local (non-remote) IDE, i.e. safe to `childProcess.spawn()`?
 */
export function isLocalIde(remoteName: string | undefined): boolean {
  return LOCAL_REMOTE_NAMES.includes(remoteName ?? "");
}

/**
 * How many consecutive capture failures we tolerate before giving up on the
 * capture path for the rest of the session.
 */
export const MAX_CAPTURE_FAILURES_BEFORE_DISABLE = 2;

/**
 * Decide whether to attempt output capture, given the number of consecutive
 * failures already observed for the current remote.
 *
 * A remote whose shell can't run our capture wrapper (e.g. a bare `sh`, a locked-down
 * container without `/tmp` write access, or a Windows-based SSH target) would otherwise
 * make *every* tool call pay the full capture timeout. Once we've seen
 * `MAX_CAPTURE_FAILURES_BEFORE_DISABLE` consecutive failures we stop trying and revert
 * to fire-and-forget for the remainder of the session.
 *
 * @param consecutiveFailures number of consecutive capture failures so far
 * @param succeeded           whether the most recent attempt succeeded
 */
export function shouldAttemptCapture(
  consecutiveFailures: number,
  succeeded: boolean,
): boolean {
  if (succeeded) {
    return true;
  }
  return consecutiveFailures < MAX_CAPTURE_FAILURES_BEFORE_DISABLE;
}

/**
 * Next failure counter after an attempt. Resets to 0 on success, increments otherwise,
 * and never goes negative (callers may pass an uninitialized counter).
 */
export function nextCaptureFailureCount(
  consecutiveFailures: number,
  succeeded: boolean,
): number {
  if (succeeded) {
    return 0;
  }
  return Math.max(0, consecutiveFailures) + 1;
}

/**
 * Build the human-readable status string for a captured remote command.
 */
export function remoteCommandStatus(
  exitCode: number | null,
): "Command completed" | string {
  return exitCode === 0 || exitCode === null
    ? "Command completed"
    : `Command exited with code ${exitCode}`;
}

/**
 * Message returned when a remote command ran but its output could not be captured.
 * Kept as a function of `remoteName` so the model is told *why* and what to do next.
 */
export function remoteOutputUnavailableMessage(
  remoteName: string | undefined,
): string {
  const suffix = supportsRemoteTerminalOutput(remoteName)
    ? "Output capture was attempted but failed on this host " +
      "(shell may not support the capture wrapper, or /tmp is not writable). " +
      "The command ran — check the VS Code terminal panel for its output."
    : `Output capture is not yet available for remote environment "${remoteName ?? "unknown"}". ` +
      "The command was sent to the terminal — check the VS Code terminal panel for its output.";
  return `Command executed in remote terminal. ${suffix}`;
}

/**
 * Short, stable substring embedded in the "shell integration unavailable" notice
 * returned by `VsCodeIde.runCommandWithOutput`.
 *
 * The tool implementation uses this to tell "the command ran but we couldn't read
 * its output because shell integration is off" apart from a genuine successful
 * capture, so the former counts against the failure budget and the latter resets it.
 *
 * MUST stay in sync with the message built in `extensions/vscode/src/VsCodeIde.ts`.
 */
export const SHELL_INTEGRATION_MISSING_MARKER =
  "[continue:shell-integration-unavailable]";

/**
 * The wording we surface when shell integration is missing on a capable remote.
 */
export const SHELL_INTEGRATION_MISSING_MESSAGE =
  `${SHELL_INTEGRATION_MISSING_MARKER} Command ran in the remote terminal, but VS Code ` +
  "shell integration is not enabled for this shell, so its output could not be " +
  "captured. Enable shell integration " +
  '("terminal.integrated.shellIntegration.enabled": true) and make sure your ' +
  "shell profile is sourced, then retry.";
