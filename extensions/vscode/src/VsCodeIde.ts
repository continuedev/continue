import * as child_process from "node:child_process";
import { exec } from "node:child_process";

import { Range } from "core";
import { DEFAULT_IGNORES, defaultIgnoresGlob } from "core/indexing/ignore";
import { EXTENSION_NAME } from "core/util/constants";
import { SHELL_INTEGRATION_MISSING_MESSAGE } from "core/util/remoteTerminal";
import * as URI from "uri-js";
import * as vscode from "vscode";

import {
  executeGotoProvider,
  executeSignatureHelpProvider,
  executeSymbolProvider,
} from "./autocomplete/lsp";
import { Repository } from "./otherExtensions/git";
import { SecretStorage } from "./stubs/SecretStorage";
import { VsCodeIdeUtils } from "./util/ideUtils";
import { getExtensionVersion, isExtensionPrerelease } from "./util/util";
import { getExtensionUri, openEditorAndRevealRange } from "./util/vscode";
import { VsCodeWebviewProtocol } from "./webviewProtocol";

import type {
  DocumentSymbol,
  FileStatsMap,
  FileType,
  IDE,
  IdeInfo,
  IdeSettings,
  IndexTag,
  Location,
  Problem,
  RangeInFile,
  SignatureHelp,
  TerminalOptions,
  Thread,
} from "core";

class VsCodeIde implements IDE {
  ideUtils: VsCodeIdeUtils;
  secretStorage: SecretStorage;

  constructor(
    private readonly vscodeWebviewProtocolPromise: Promise<VsCodeWebviewProtocol>,
    private readonly context: vscode.ExtensionContext,
  ) {
    this.ideUtils = new VsCodeIdeUtils();
    this.secretStorage = new SecretStorage(context);
  }

  async readSecrets(keys: string[]): Promise<Record<string, string>> {
    const secretValuePromises = keys.map((key) => this.secretStorage.get(key));
    const secretValues = await Promise.all(secretValuePromises);

    return keys.reduce(
      (acc, key, index) => {
        if (secretValues[index] === undefined) {
          return acc;
        }

        acc[key] = secretValues[index];
        return acc;
      },
      {} as Record<string, string>,
    );
  }

  async writeSecrets(secrets: { [key: string]: string }): Promise<void> {
    for (const [key, value] of Object.entries(secrets)) {
      await this.secretStorage.store(key, value);
    }
  }

  async fileExists(uri: string): Promise<boolean> {
    try {
      const stat = await this.ideUtils.stat(vscode.Uri.parse(uri));
      return stat !== null;
    } catch (error) {
      if (error instanceof vscode.FileSystemError) {
        return false;
      }
      throw error;
    }
  }

  async gotoDefinition(location: Location): Promise<RangeInFile[]> {
    const result = await executeGotoProvider({
      uri: vscode.Uri.parse(location.filepath),
      line: location.position.line,
      character: location.position.character,
      name: "vscode.executeDefinitionProvider",
    });

    return result;
  }

  async gotoTypeDefinition(location: Location): Promise<RangeInFile[]> {
    const result = await executeGotoProvider({
      uri: vscode.Uri.parse(location.filepath),
      line: location.position.line,
      character: location.position.character,
      name: "vscode.executeTypeDefinitionProvider",
    });

    return result;
  }

  async getSignatureHelp(location: Location): Promise<SignatureHelp | null> {
    const result = await executeSignatureHelpProvider({
      uri: vscode.Uri.parse(location.filepath),
      line: location.position.line,
      character: location.position.character,
      name: "vscode.executeSignatureHelpProvider",
    });

    return result;
  }

  async getReferences(location: Location): Promise<RangeInFile[]> {
    const result = await executeGotoProvider({
      uri: vscode.Uri.parse(location.filepath),
      line: location.position.line,
      character: location.position.character,
      name: "vscode.executeReferenceProvider",
    });

    return result;
  }

  async getDocumentSymbols(
    textDocumentIdentifier: string, // uri
  ): Promise<DocumentSymbol[]> {
    const result = await executeSymbolProvider({
      uri: vscode.Uri.parse(textDocumentIdentifier),
      name: "vscode.executeDocumentSymbolProvider",
    });

    return result;
  }

  onDidChangeActiveTextEditor(callback: (uri: string) => void): void {
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        callback(editor.document.uri.toString());
      }
    });
  }

  showToast: IDE["showToast"] = async (...params) => {
    const [type, message, ...otherParams] = params;
    const { showErrorMessage, showWarningMessage, showInformationMessage } =
      vscode.window;

    switch (type) {
      case "error":
        return showErrorMessage(message, "Show logs").then((selection) => {
          if (selection === "Show logs") {
            vscode.commands.executeCommand("workbench.action.toggleDevTools");
          }
        });
      case "info":
        return showInformationMessage(message, ...otherParams);
      case "warning":
        return showWarningMessage(message, ...otherParams);
    }
  };

  async getRepoName(dir: string): Promise<string | undefined> {
    const repo = await this.getRepo(dir);
    const remotes = repo?.state.remotes;
    if (!remotes) {
      return undefined;
    }
    const remote =
      remotes?.find((r: any) => r.name === "origin") ?? remotes?.[0];
    if (!remote) {
      return undefined;
    }
    const ownerAndRepo = remote.fetchUrl
      ?.replace(".git", "")
      .split("/")
      .slice(-2);
    return ownerAndRepo?.join("/");
  }

  async getTags(artifactId: string): Promise<IndexTag[]> {
    const workspaceDirs = await this.getWorkspaceDirs();

    const branches = await Promise.all(
      workspaceDirs.map((dir) => this.getBranch(dir)),
    );

    const tags: IndexTag[] = workspaceDirs.map((directory, i) => ({
      directory,
      branch: branches[i],
      artifactId,
    }));

    return tags;
  }

  getIdeInfo(): Promise<IdeInfo> {
    return Promise.resolve({
      ideType: "vscode",
      name: vscode.env.appName,
      version: vscode.version,
      remoteName: vscode.env.remoteName || "local",
      extensionVersion: getExtensionVersion(),
      isPrerelease: isExtensionPrerelease(),
    });
  }

  readRangeInFile(fileUri: string, range: Range): Promise<string> {
    return this.ideUtils.readRangeInFile(
      vscode.Uri.parse(fileUri),
      new vscode.Range(
        new vscode.Position(range.start.line, range.start.character),
        new vscode.Position(range.end.line, range.end.character),
      ),
    );
  }

  async getFileStats(files: string[]): Promise<FileStatsMap> {
    const pathToLastModified: FileStatsMap = {};
    await Promise.all(
      files.map(async (file) => {
        const stat = await this.ideUtils.stat(
          vscode.Uri.parse(file),
          false /* No need to catch ENOPRO exceptions */,
        );
        pathToLastModified[file] = {
          lastModified: stat!.mtime,
          size: stat!.size,
        };
      }),
    );

    return pathToLastModified;
  }

  async getRepo(dir: string): Promise<Repository | undefined> {
    return this.ideUtils.getRepo(vscode.Uri.parse(dir));
  }

  async isTelemetryEnabled(): Promise<boolean> {
    const globalEnabled = vscode.env.isTelemetryEnabled;
    const continueEnabled: boolean =
      (await vscode.workspace
        .getConfiguration(EXTENSION_NAME)
        .get("telemetryEnabled")) ?? true;
    return globalEnabled && continueEnabled;
  }

  isWorkspaceRemote(): Promise<boolean> {
    return Promise.resolve(vscode.env.remoteName !== undefined);
  }

  getUniqueId(): Promise<string> {
    return Promise.resolve(vscode.env.machineId);
  }

  async getDiff(includeUnstaged: boolean): Promise<string[]> {
    return await this.ideUtils.getDiff(includeUnstaged);
  }

  async getClipboardContent() {
    return {
      text: await vscode.env.clipboard.readText(),
      copiedAt: new Date().toISOString(),
    };
  }

  async getTerminalContents(): Promise<string> {
    return await this.ideUtils.getTerminalContents(1);
  }

  async getDebugLocals(threadIndex: number): Promise<string> {
    return await this.ideUtils.getDebugLocals(threadIndex);
  }

  async getTopLevelCallStackSources(
    threadIndex: number,
    stackDepth: number,
  ): Promise<string[]> {
    return await this.ideUtils.getTopLevelCallStackSources(
      threadIndex,
      stackDepth,
    );
  }
  async getAvailableThreads(): Promise<Thread[]> {
    return await this.ideUtils.getAvailableThreads();
  }

  async getWorkspaceDirs(): Promise<string[]> {
    return this.ideUtils.getWorkspaceDirectories().map((uri) => uri.toString());
  }

  async writeFile(fileUri: string, contents: string): Promise<void> {
    await vscode.workspace.fs.writeFile(
      vscode.Uri.parse(fileUri),
      Buffer.from(contents),
    );
  }

  async removeFile(fileUri: string): Promise<void> {
    await vscode.workspace.fs.delete(vscode.Uri.parse(fileUri));
  }

  async showVirtualFile(title: string, contents: string): Promise<void> {
    this.ideUtils.showVirtualFile(title, contents);
  }

  async openFile(fileUri: string): Promise<void> {
    await this.ideUtils.openFile(vscode.Uri.parse(fileUri));
  }

  async showLines(
    fileUri: string,
    startLine: number,
    endLine: number,
  ): Promise<void> {
    const range = new vscode.Range(
      new vscode.Position(startLine, 0),
      new vscode.Position(endLine, 0),
    );
    openEditorAndRevealRange(vscode.Uri.parse(fileUri), range).then(
      (editor) => {
        // Select the lines
        editor.selection = new vscode.Selection(
          new vscode.Position(startLine, 0),
          new vscode.Position(endLine, 0),
        );
      },
    );
  }

  async runCommand(
    command: string,
    options: TerminalOptions = { reuseTerminal: true },
  ): Promise<void> {
    let terminal: vscode.Terminal | undefined;
    if (vscode.window.terminals.length && options.reuseTerminal) {
      if (options.terminalName) {
        terminal = vscode.window.terminals.find(
          (t) => t?.name === options.terminalName,
        );
      } else {
        terminal = vscode.window.activeTerminal ?? vscode.window.terminals[0];
      }
    }

    if (!terminal) {
      terminal = vscode.window.createTerminal(options?.terminalName);
    }
    terminal.show();
    terminal.sendText(command, false);
  }

  /**
   * Run a command in the remote terminal and capture its output.
   *
   * STABLE-API-ONLY STRATEGY (works in published extensions, no proposed APIs):
   *
   * IMPORTANT: VS Code's `onDidWriteTerminalData` is a PROPOSED API — it only works in
   * extension development / Insiders builds and THROWS in published extensions:
   *   "Extension 'continue.continue' CANNOT use API proposal: terminalDataWriteEvent."
   * We therefore do NOT use it. We rely only on the STABLE shell integration API
   * (available since VS Code 1.93):
   *   - terminal.shellIntegration.executeCommand()        [stable]
   *   - window.onDidEndTerminalShellExecution             [stable]
   *   - execution.read()  (async iterable of output)      [stable]
   *
   * Completion detection combines THREE signals (first to fire wins):
   *   A. onDidEndTerminalShellExecution for OUR execution  → precise exitCode
   *   B. read() stream completes (for-await loop ends)     → output done
   *   C. graceful timeout                                   → return partial output
   *
   * This fixes the hang on ssh/pipe/multiline commands where any single signal may
   * never fire (microsoft/vscode#324392, #316556): if the stream ends but the end
   * event doesn't (or vice-versa), we still resolve.
   *
   * If shell integration is unavailable (shell not yet instrumented), we fall back to
   * fire-and-forget sendText() + fixed delay — no output, but never hangs and never
   * throws a proposed-API error.
   */
  /**
   * Deterministic, race-free command capture via temp files.
   *
   * Writes the command's combined stdout+stderr to a temp file and its exit code to a
   * "done" marker file. Polls (via vscode.workspace.fs — not the terminal) until the
   * marker file exists, then reads the output file. Because we read a FILE rather than
   * the shell-integration stream, there is no PTY/IPC timing race: when the marker file
   * is present, the output file is guaranteed fully written.
   *
   * Returns null if a temp directory/URI could not be resolved (caller falls back to
   * the shell-integration stream approach).
   */
  private async runViaFileCapture(
    terminal: vscode.Terminal,
    command: string,
    timeoutMs: number,
  ): Promise<{ output: string; exitCode: number | null } | null> {
    // Resolve a base URI that shares the remote authority (wsl+.../ssh-remote+...).
    const wsDirs = await this.getWorkspaceDirs();
    if (!wsDirs.length) return null;

    let baseUri: vscode.Uri;
    try {
      baseUri = vscode.Uri.parse(wsDirs[0]);
    } catch {
      return null;
    }
    if (!/^(file|vscode-remote)$/.test(baseUri.scheme)) return null;

    // Resolve a writable temp dir on the REMOTE side.
    //
    // `/tmp` is the right default and is world-writable on Linux/macOS remotes
    // (wsl, ssh-remote, dev-container, codespaces). But some hardened SSH targets
    // mount /tmp noexec/nosuid or restrict it, and Windows-based SSH hosts have no
    // /tmp at all — so probe with `fileExists` and fall back to the workspace root,
    // which is always writable because that is where the user is editing files.
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const tmpOutPath = `/tmp/continue_out_${id}`;

    let tmpWritable = false;
    try {
      tmpWritable = await vscode.workspace.fs.stat(
        baseUri.with({ path: "/tmp" }),
      ).then(
        () => true,
        () => false,
      );
    } catch {
      tmpWritable = false;
    }

    // Strip any trailing slash so we don't build "//continue_out_x".
    const workspaceRootPath = (baseUri.path || "/").replace(/\/+$/, "") || "/";
    const outPath = tmpWritable
      ? tmpOutPath
      : `${workspaceRootPath}/.continue_out_${id}`;
    const donePath = tmpWritable
      ? `/tmp/continue_done_${id}`
      : `${workspaceRootPath}/.continue_done_${id}`;

    const outUri = baseUri.with({ path: outPath });
    const doneUri = baseUri.with({ path: donePath });

    // Read the user's output-mode preference.
    // "silent"  (default) — redirect to file only; terminal shows base64 one-liner.
    // "visible"           — tee so output is visible in terminal AND captured in file.
    const outputMode = vscode.workspace
      .getConfiguration("continue")
      .get<string>("remoteTerminalOutputMode", "silent");

    // base64-encode so ALL command shapes (heredoc, quotes, $VAR, pipes, &&, ssh) run
    // verbatim inside a subshell without escaping hazards.
    const b64 = Buffer.from(command, "utf8").toString("base64");

    let wrapped: string;
    if (outputMode === "visible") {
      // "visible" mode: tee duplicates output → terminal panel + file simultaneously.
      //
      // POSIX-safe exit-code capture — works on bash, dash, sh (busybox, slim containers):
      //
      //   { cmd ; printf '%s\n' "$?" > donefile ; } 2>&1 | tee outfile
      //
      // The key insight: write the exit code INSIDE the left-hand group, before the pipe
      // to tee. This avoids both bash-only constructs:
      //   - `${PIPESTATUS[0]}` → "Bad substitution" on dash/sh
      //   - `set -o pipefail`  → "Illegal option" on dash (exit 2, subshell aborts before
      //                          tee runs, done-file is never written → stalls until timeout)
      //
      // tee always exits 0 so we cannot use the outer `$?`. Reading rc from inside the
      // group is deterministic: the done-file is written synchronously before tee finishes.
      //
      // The original command is echoed as a comment so it stays readable in the terminal.
      const preview = command.length > 120 ? command.slice(0, 120) + "…" : command;
      wrapped =
        // Print the original command as a comment so users can read it in the terminal.
        `echo '# ${preview.replace(/'/g, "'\\''")}' ; ` +
        `{ echo ${b64} | base64 -d | bash ; printf '%s\\n' "$?" > ${donePath} ; } 2>&1 | tee ${outPath}`;
    } else {
      // "silent" mode (default): no terminal output, pure file capture.
      wrapped =
        `{ echo ${b64} | base64 -d | bash ; } > ${outPath} 2>&1 ; ` +
        `printf '%s\\n' "$?" > ${donePath}`;
    }

    terminal.show(false);
    terminal.sendText(wrapped, true);

    // Poll for the done-file via the filesystem API (deterministic).
    const pollInterval = 200;
    const deadline = Date.now() + timeoutMs;
    let exitCode: number | null = null;

    const readTextFile = async (uri: vscode.Uri): Promise<string | null> => {
      try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        return new TextDecoder().decode(bytes);
      } catch {
        return null;
      }
    };

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, pollInterval));
      const doneContent = await readTextFile(doneUri);
      if (doneContent !== null) {
        const parsed = parseInt(doneContent.trim(), 10);
        exitCode = Number.isNaN(parsed) ? null : parsed;
        break;
      }
    }

    // Read the output file (may be empty for commands with no output — that's valid).
    const outContent = (await readTextFile(outUri)) ?? "";

    // Best-effort cleanup of temp files (don't block on failures).
    const rm = async (uri: vscode.Uri) => {
      try {
        await vscode.workspace.fs.delete(uri);
      } catch {
        /* ignore */
      }
    };
    void rm(outUri);
    void rm(doneUri);

    if (exitCode === null && outContent === "") {
      // Timed out with no done-file and no output — treat as capture failure, let caller
      // fall back. (Rare: /tmp not writable, etc.)
      return null;
    }

    return { output: outContent.replace(/\r\n/g, "\n").trimEnd(), exitCode };
  }

  async runCommandWithOutput(
    command: string,
    timeoutMs = 120_000,
  ): Promise<{ output: string; exitCode: number | null }> {
    // --- Find or create a terminal ---
    let terminal =
      vscode.window.activeTerminal ?? vscode.window.terminals[0];
    if (!terminal) {
      terminal = vscode.window.createTerminal("Continue");
    }
    terminal.show(false); // show without stealing focus

    const si = (terminal as any).shellIntegration;
    const onDidEnd = (vscode.window as any).onDidEndTerminalShellExecution;

    // =========================================================================
    // PRIMARY STRATEGY: file-based capture (deterministic, race-free)
    //
    // The VS Code shell-integration read() stream is NOT reliable for timing: the
    // OSC 633;D "command finished" marker is delivered asynchronously from the PTY,
    // and read() can end BEFORE VS Code has gathered all output bytes — intermittently
    // returning empty/partial output for fast commands (microsoft/vscode#221405 and
    // related). No amount of event juggling fully eliminates this race.
    //
    // Instead, we redirect the command's output to a temp file and read the file back.
    // File I/O via vscode.workspace.fs is deterministic — once the shell writes a
    // "done" marker file, the output file is guaranteed complete. Zero race.
    //
    // Flow (single shell line, works for ssh/pipe/heredoc via base64):
    //   { <cmd> } > <out> 2>&1 ; echo $? > <done>
    // We poll for <done> to appear, then read <out>, then clean up.
    // =========================================================================
    const fileResult = await this.runViaFileCapture(terminal, command, timeoutMs);
    if (fileResult) {
      return fileResult;
    }

    // =========================================================================
    // FALLBACK STRATEGY: shell-integration stream (only if file capture unavailable,
    // e.g. cannot resolve a writable temp dir). Kept for resilience.
    // =========================================================================

    // --- Normalize multi-line / heredoc commands to a SINGLE logical line ---
    let effectiveCommand = command;
    if (/\r|\n/.test(command)) {
      const b64 = Buffer.from(command, "utf8").toString("base64");
      effectiveCommand = `echo ${b64} | base64 -d | bash`;
    }

    // --- Fallback: shell integration not ready → fire-and-forget (never hangs) ---
    if (!si || typeof si.executeCommand !== "function" || typeof onDidEnd !== "function") {
      terminal.sendText(effectiveCommand, true);
      await new Promise((r) => setTimeout(r, 1500));
      return {
        output: SHELL_INTEGRATION_MISSING_MESSAGE,
        exitCode: null,
      };
    }

    const result = await new Promise<{ output: string; exitCode: number | null }>(
      (resolve) => {
        let settled = false;
        let output = "";
        let execution: any = null;
        let streamEnded = false;
        let exitFromEvent: number | null = null;
        let endEventFired = false;

        const disposables: Array<{ dispose: () => void }> = [];
        const cleanup = () => {
          for (const d of disposables) {
            try {
              d.dispose();
            } catch {
              /* ignore */
            }
          }
        };

        const stripAnsi = (s: string) =>
          s
            .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "")
            .replace(/\x1b\][^\x07]*\x07/g, "")
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n");

        // Fallback timer: armed only when the end event fires BEFORE the stream finishes.
        // Gives the read() stream a bounded window to flush remaining output, then resolves
        // even if the stream never formally ends (defensive against stuck streams).
        let flushTimer: ReturnType<typeof setTimeout> | undefined;

        const finish = (exitCode: number | null) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          if (flushTimer) clearTimeout(flushTimer);
          cleanup();
          resolve({ output: stripAnsi(output).trim(), exitCode });
        };

        const timeout = setTimeout(() => {
          // Graceful timeout — return whatever we have.
          finish(exitFromEvent);
        }, timeoutMs);

        // Register end-event listener BEFORE executeCommand to avoid missing fast commands.
        const endDisposable = onDidEnd((e: any) => {
          if (settled) return;
          // Match our execution if known; otherwise match the terminal.
          const matches = execution ? e.execution === execution : e.terminal === terminal;
          if (!matches) return;
          endEventFired = true;
          if (typeof e.exitCode === "number") {
            exitFromEvent = e.exitCode;
          }

          // CRITICAL for fast commands: the end event often fires BEFORE read() has
          // emitted (or finished emitting) the output chunks. Resolving here immediately
          // would return empty/partial output. So:
          //   - If the stream already ended → safe to resolve now.
          //   - Otherwise → WAIT for the stream to end (the `finally` block calls finish).
          //     Arm a bounded safety timer only as a last resort in case the stream
          //     never ends (observed for some shell-integration edge cases).
          if (streamEnded) {
            finish(exitFromEvent);
          } else if (!flushTimer) {
            // Safety net: if the stream is stuck, resolve after a generous flush window.
            flushTimer = setTimeout(() => finish(exitFromEvent), 3000);
          }
        });
        disposables.push(endDisposable);

        // Start the command (normalized to single-line for multi-line/heredoc inputs).
        try {
          execution = si.executeCommand(effectiveCommand);
        } catch (err) {
          // executeCommand threw — fall back to fire-and-forget.
          finish(null);
          terminal!.sendText(effectiveCommand, true);
          return;
        }

        // Consume the output stream.
        (async () => {
          try {
            const stream = execution.read();
            for await (const chunk of stream) {
              if (settled) break;
              output += chunk;
            }
          } catch {
            // stream error — rely on end event / timeout
          } finally {
            streamEnded = true;
            // Stream finished → we now have the complete output.
            // Resolve if the end event already fired (we have exitCode), OR if it hasn't
            // fired yet (rare): give it a brief moment, then resolve regardless so we
            // never hang. The stream ending is the authoritative "output complete" signal.
            if (endEventFired) {
              finish(exitFromEvent);
            } else if (!settled) {
              setTimeout(() => finish(exitFromEvent), 300);
            }
          }
        })();
      },
    );

    return result;
  }

  /**
   * Extract command output from raw terminal data captured in the sentinel fallback.
   * Strips ANSI/OSC escapes, removes the echoed command input line, the echoed sentinel
   * input line, and the sentinel output line itself.
   */
  private cleanOutputHelper(raw: string, token: string): string {
    const clean = raw
      .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "") // CSI escapes
      .replace(/\x1b\][^\x07]*\x07/g, "") // OSC escapes
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");

    const lines = clean.split("\n");

    // Find the sentinel OUTPUT line (token followed by :EXIT=<digits>).
    const sentinelOutIdx = lines.findIndex((l) =>
      new RegExp(`${token}:EXIT=\\d+`).test(l),
    );

    // Keep only lines that are neither the echoed input (containing `echo "<token>`)
    // nor the sentinel output line, and stop at the sentinel output.
    const upto = sentinelOutIdx >= 0 ? sentinelOutIdx : lines.length;
    const kept: string[] = [];
    for (let i = 0; i < upto; i++) {
      const line = lines[i];
      // Skip the line where we typed the sentinel echo command.
      if (line.includes(`echo "${token}`)) continue;
      // Skip any line still containing the token (defensive).
      if (line.includes(token)) continue;
      kept.push(line);
    }

    // The first kept line is usually the prompt + the primary command echo.
    // Drop it only if it clearly contains the command prompt artifacts; otherwise keep.
    return kept.join("\n").trim();
  }

  async saveFile(fileUri: string): Promise<void> {
    await this.ideUtils.saveFile(vscode.Uri.parse(fileUri));
  }

  private static MAX_BYTES = 100000;

  async readFile(fileUri: string): Promise<string> {
    try {
      const uri = vscode.Uri.parse(fileUri);

      // First, check whether it's a notebook document
      // Need to iterate over the cells to get full contents
      const notebook =
        vscode.workspace.notebookDocuments.find((doc) =>
          URI.equal(doc.uri.toString(), uri.toString()),
        ) ??
        (uri.path.endsWith("ipynb")
          ? await vscode.workspace.openNotebookDocument(uri)
          : undefined);
      if (notebook) {
        return notebook
          .getCells()
          .map((cell) => cell.document.getText())
          .join("\n\n");
      }

      // Check whether it's an open document
      const openTextDocument = vscode.workspace.textDocuments.find((doc) =>
        URI.equal(doc.uri.toString(), uri.toString()),
      );
      if (openTextDocument !== undefined) {
        return openTextDocument.getText();
      }

      const fileStats = await this.ideUtils.stat(uri);
      if (fileStats === null || fileStats.size > 10 * VsCodeIde.MAX_BYTES) {
        return "";
      }

      const bytes = await this.ideUtils.readFile(uri);
      if (bytes === null) {
        return "";
      }

      // Truncate the buffer to the first MAX_BYTES
      const truncatedBytes = bytes.slice(0, VsCodeIde.MAX_BYTES);
      const contents = new TextDecoder().decode(truncatedBytes);
      return contents;
    } catch (e) {
      return "";
    }
  }

  async openUrl(url: string): Promise<void> {
    await vscode.env.openExternal(vscode.Uri.parse(url));
  }

  async getExternalUri(uri: string): Promise<string> {
    const vsCodeUri = vscode.Uri.parse(uri);
    const externalUri = await vscode.env.asExternalUri(vsCodeUri);
    return externalUri.toString(true);
  }

  async getOpenFiles(): Promise<string[]> {
    return this.ideUtils.getOpenFiles().map((uri) => uri.toString());
  }

  async getCurrentFile() {
    if (!vscode.window.activeTextEditor) {
      return undefined;
    }
    return {
      isUntitled: vscode.window.activeTextEditor.document.isUntitled,
      path: vscode.window.activeTextEditor.document.uri.toString(),
      contents: vscode.window.activeTextEditor.document.getText(),
    };
  }

  async getPinnedFiles(): Promise<string[]> {
    const tabArray = vscode.window.tabGroups.all[0].tabs;

    return tabArray
      .filter((t) => t.isPinned)
      .map((t) => (t.input as vscode.TabInputText).uri.toString());
  }

  runRipgrepQuery(dirUri: string, args: string[]) {
    const relativeDir = vscode.Uri.parse(dirUri).fsPath;
    const ripGrepUri = vscode.Uri.joinPath(
      getExtensionUri(),
      "out/node_modules/@vscode/ripgrep/bin/rg",
    );
    const p = child_process.spawn(ripGrepUri.fsPath, args, {
      cwd: relativeDir,
    });
    let output = "";

    p.stdout.on("data", (data) => {
      output += data.toString();
    });

    return new Promise<string>((resolve, reject) => {
      p.on("error", reject);
      p.on("close", (code) => {
        if (code === 0) {
          resolve(output);
        } else if (code === 1) {
          // No matches
          resolve(
            "No matches found. Build, secrets, etc. dirs and files are not included.",
          );
        } else {
          reject(new Error(`Process exited with code ${code}`));
        }
      });
    });
  }

  async getFileResults(
    pattern: string,
    maxResults?: number,
  ): Promise<string[]> {
    // Create a single combined ignore pattern for ripgrep (calculated once)

    if (vscode.env.remoteName) {
      // TODO better tests for this remote search implementation
      // throw new Error("Ripgrep not supported, this workspace is remote");

      // IMPORTANT: findFiles automatically accounts for .gitignore
      const ignoreFiles = await vscode.workspace.findFiles(
        "**/.continueignore",
        null,
      );

      const ignoreGlobs: Set<string> = new Set();
      // Add default ignores from core
      for (const pattern of DEFAULT_IGNORES) {
        ignoreGlobs.add(pattern);
      }

      for (const file of ignoreFiles) {
        const content = await this.ideUtils.readFile(file);
        if (content === null) {
          continue;
        }
        const filePath = vscode.workspace.asRelativePath(file);
        const fileDir = filePath
          .replace(/\\/g, "/")
          .replace(/\/$/, "")
          .split("/")
          .slice(0, -1)
          .join("/");

        const patterns = Buffer.from(content)
          .toString()
          .split("\n")
          .map((line) => line.trim())
          .filter(
            (line) => line && !line.startsWith("#") && !pattern.startsWith("!"),
          );
        // VSCode does not support negations

        patterns
          // Handle prefix
          .map((pattern) => {
            const normalizedPattern = pattern.replace(/\\/g, "/");

            if (normalizedPattern.startsWith("/")) {
              if (fileDir) {
                return `{/,}${normalizedPattern}`;
              } else {
                return `${fileDir}/${normalizedPattern.substring(1)}`;
              }
            } else {
              if (fileDir) {
                return `${fileDir}/${normalizedPattern}`;
              } else {
                return `**/${normalizedPattern}`;
              }
            }
          })
          // Handle suffix
          .map((pattern) => {
            return pattern.endsWith("/") ? `${pattern}**/*` : pattern;
          })
          .forEach((pattern) => {
            ignoreGlobs.add(pattern);
          });
      }

      const ignoreGlobsArray = Array.from(ignoreGlobs);

      const results = await vscode.workspace.findFiles(
        pattern,
        ignoreGlobs.size ? `{${ignoreGlobsArray.join(",")}}` : null,
        maxResults,
      );
      return results.map((result) => vscode.workspace.asRelativePath(result));
    } else {
      const results: string[] = [];
      // Create a single combined ignore pattern using glob brace expansion
      for (const dir of await this.getWorkspaceDirs()) {
        const dirResults = await this.runRipgrepQuery(dir, [
          "--files",
          "--iglob",
          pattern,
          "--ignore-file",
          ".continueignore",
          "--ignore-file",
          ".gitignore",
          "--glob",
          defaultIgnoresGlob,
          ...(maxResults ? ["--max-count", String(maxResults)] : []),
        ]);

        results.push(dirResults);
      }

      const allResults = results.join("\n").split("\n");
      if (maxResults) {
        // In the case of multiple workspaces, maxResults will be applied to each workspace
        // And then the combined results will also be truncated
        return allResults.slice(0, maxResults);
      } else {
        return allResults;
      }
    }
  }

  async getSearchResults(query: string, maxResults?: number): Promise<string> {
    if (vscode.env.remoteName) {
      throw new Error("Ripgrep not supported, this workspace is remote");
    }
    const results: string[] = [];

    for (const dir of await this.getWorkspaceDirs()) {
      const dirResults = await this.runRipgrepQuery(dir, [
        "-i", // Case-insensitive search
        "--ignore-file",
        ".continueignore",
        "--ignore-file",
        ".gitignore",
        "-C",
        "2", // Show 2 lines of context
        "--heading", // Only show filepath once per result
        // Use a single glob with all default ignores
        "--glob",
        defaultIgnoresGlob,
        ...(maxResults ? ["-m", maxResults.toString()] : []),
        "-e",
        query, // Pattern to search for
        ".", // Directory to search in
      ]);

      results.push(dirResults);
    }

    const allResults = results.join("\n");
    if (maxResults) {
      // In case of multiple workspaces, do max results per workspace and then truncate to maxResults
      // Will prioritize first workspace results, fine for now
      // Results are separated by either ./ or --
      const matches = Array.from(allResults.matchAll(/(\n--|\n\.\/)/g));
      if (matches.length > maxResults) {
        return allResults.substring(0, matches[maxResults].index);
      } else {
        return allResults;
      }
    } else {
      return allResults;
    }
  }

  async getProblems(fileUri?: string | undefined): Promise<Problem[]> {
    const uri = fileUri
      ? vscode.Uri.parse(fileUri)
      : vscode.window.activeTextEditor?.document.uri;
    if (!uri) {
      return [];
    }
    return vscode.languages.getDiagnostics(uri).map((d) => {
      return {
        filepath: uri.toString(),
        range: {
          start: {
            line: d.range.start.line,
            character: d.range.start.character,
          },
          end: { line: d.range.end.line, character: d.range.end.character },
        },
        message: d.message,
      };
    });
  }

  async subprocess(command: string, cwd?: string): Promise<[string, string]> {
    return new Promise((resolve, reject) => {
      exec(command, { cwd }, (error, stdout, stderr) => {
        if (error) {
          console.warn(error);
          reject(stderr);
        }
        resolve([stdout, stderr]);
      });
    });
  }

  async getBranch(dir: string): Promise<string> {
    return this.ideUtils.getBranch(vscode.Uri.parse(dir));
  }

  async getGitRootPath(dir: string): Promise<string | undefined> {
    const root = await this.ideUtils.getGitRoot(vscode.Uri.parse(dir));
    return root?.toString();
  }

  async listDir(dir: string): Promise<[string, FileType][]> {
    const entries = await this.ideUtils.readDirectory(vscode.Uri.parse(dir));
    return entries === null ? [] : (entries as any);
  }

  private getIdeSettingsSync(): IdeSettings {
    const settings = vscode.workspace.getConfiguration(EXTENSION_NAME);
    const remoteConfigServerUrl = settings.get<string | undefined>(
      "remoteConfigServerUrl",
      undefined,
    );
    const ideSettings: IdeSettings = {
      remoteConfigServerUrl,
      remoteConfigSyncPeriod: settings.get<number>(
        "remoteConfigSyncPeriod",
        60,
      ),
      userToken: settings.get<string>("userToken", ""),
      continueTestEnvironment: "production",
      pauseCodebaseIndexOnStart: settings.get<boolean>(
        "pauseCodebaseIndexOnStart",
        false,
      ),
    };
    return ideSettings;
  }

  async getIdeSettings(): Promise<IdeSettings> {
    const ideSettings = this.getIdeSettingsSync();
    return ideSettings;
  }
}

export { VsCodeIde };
