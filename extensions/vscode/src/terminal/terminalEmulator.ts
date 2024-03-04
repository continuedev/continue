/* Terminal emulator - commented because node-pty is causing problems. */

import * as os from "os";
import stripAnsi from "strip-ansi";
import * as vscode from "vscode";
import { longestCommonSubsequence } from "../util/lcs";

function loadNativeModule<T>(id: string): T | null {
  try {
    return require(`${vscode.env.appRoot}/node_modules.asar/${id}`);
  } catch (err) {
    // ignore
  }

  try {
    return require(`${vscode.env.appRoot}/node_modules/${id}`);
  } catch (err) {
    // ignore
  }

  return null;
}

const pty = loadNativeModule<any>("node-pty");

function getDefaultShell(): string {
  if (process.platform !== "win32") {
    return os.userInfo().shell || "cmd";
  }
  switch (process.platform) {
    case "win32":
      return process.env.COMSPEC || "cmd.exe";
    // case "darwin":
    //   return process.env.SHELL || "/bin/zsh";
    // default:
    //   return process.env.SHELL || "/bin/sh";
  }
}

function getRootDir(): string | undefined {
  const isWindows = os.platform() === "win32";
  let cwd = isWindows ? process.env.USERPROFILE : process.env.HOME;
  if (
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders.length > 0
  ) {
    cwd = vscode.workspace.workspaceFolders[0].uri.fsPath;
  }
  return cwd;
}

export class CapturedTerminal {
  private readonly terminal: vscode.Terminal;
  private readonly shellCmd: string;
  private readonly ptyProcess: any;

  private shellPrompt: string | undefined = undefined;
  private dataBuffer: string = "";

  private onDataListeners: ((data: string) => void)[] = [];

  show() {
    this.terminal.show();
  }

  isClosed(): boolean {
    return this.terminal.exitStatus !== undefined;
  }

  private commandQueue: [string, (output: string) => void][] = [];
  private hasRunCommand: boolean = false;

  private dataEndsInPrompt(strippedData: string): boolean {
    const lines = strippedData.split("\n");
    const lastLine = lines[lines.length - 1];

    return (
      lines.length > 0 &&
      (((lastLine.includes("bash-") || lastLine.includes(") $ ")) &&
        lastLine.includes("$")) ||
        (lastLine.includes("]> ") && lastLine.includes(") [")) ||
        (lastLine.includes(" (") && lastLine.includes(")>")) ||
        (typeof this.commandPromptString !== "undefined" &&
          (lastLine.includes(this.commandPromptString) ||
            this.commandPromptString.length -
              longestCommonSubsequence(lastLine, this.commandPromptString)
                .length <
              3)))
    );
  }

  private async waitForCommandToFinish() {
    return new Promise<string>((resolve, reject) => {
      this.onDataListeners.push((data: any) => {
        const strippedData = stripAnsi(data);
        this.dataBuffer += strippedData;
        if (this.dataEndsInPrompt(strippedData)) {
          resolve(this.dataBuffer);
          this.dataBuffer = "";
          this.onDataListeners = [];
        }
      });
    });
  }

  async runCommand(command: string): Promise<string> {
    if (this.commandQueue.length === 0) {
      return new Promise(async (resolve, reject) => {
        this.commandQueue.push([command, resolve]);

        while (this.commandQueue.length > 0) {
          const [command, resolve] = this.commandQueue.shift()!;

          // Refresh the command prompt string every time in case it changes
          await this.refreshCommandPromptString();

          this.terminal.sendText(command);
          const output = await this.waitForCommandToFinish();
          resolve(output);
        }
      });
    } else {
      return new Promise((resolve, reject) => {
        this.commandQueue.push([command, resolve]);
      });
    }
  }

  private readonly writeEmitter: vscode.EventEmitter<string>;

  private splitByCommandsBuffer: string = "";
  private readonly onCommandOutput: ((output: string) => void) | undefined;

  splitByCommandsListener(data: string) {
    // Split the output by commands so it can be sent to Continue Server

    const strippedData = stripAnsi(data);
    this.splitByCommandsBuffer += data;
    if (this.dataEndsInPrompt(strippedData)) {
      if (this.onCommandOutput) {
        this.onCommandOutput(stripAnsi(this.splitByCommandsBuffer));
      }
      this.splitByCommandsBuffer = "";
    }
  }

  private runningClearToGetPrompt: boolean = false;
  private seenClear: boolean = false;
  private commandPromptString: string | undefined = undefined;
  private resolveMeWhenCommandPromptStringFound:
    | ((_: unknown) => void)
    | undefined = undefined;

  private async refreshCommandPromptString(): Promise<string | undefined> {
    // Sends a message that will be received by the terminal to get the command prompt string, see the onData method below in constructor.
    this.runningClearToGetPrompt = true;
    this.terminal.sendText("echo");
    const promise = new Promise((resolve, reject) => {
      this.resolveMeWhenCommandPromptStringFound = resolve;
    });
    await promise;
    return this.commandPromptString;
  }

  constructor(
    options: { name: string } & Partial<vscode.ExtensionTerminalOptions>,
    onCommandOutput?: (output: string) => void,
  ) {
    this.onCommandOutput = onCommandOutput;

    // this.shellCmd = "bash"; // getDefaultShell();
    this.shellCmd = getDefaultShell();

    const env = { ...(process.env as any) };
    if (os.platform() !== "win32") {
      env.PATH += `:${["/opt/homebrew/bin", "/opt/homebrew/sbin"].join(":")}`;
    }

    // Create the pseudo terminal
    this.ptyProcess = pty.spawn(this.shellCmd, [], {
      name: "xterm-256color",
      cols: 250, // No way to get the size of VS Code terminal, or listen to resize, so make it just bigger than most conceivable VS Code widths
      rows: 26,
      cwd: getRootDir(),
      env,
      useConpty: true,
    });

    this.writeEmitter = new vscode.EventEmitter<string>();

    this.ptyProcess.onData((data: any) => {
      if (this.runningClearToGetPrompt) {
        if (
          stripAnsi(data)
            .split("\n")
            .flatMap((line) => line.split("\r"))
            .find((line) => line.trim() === "echo") !== undefined
        ) {
          this.seenClear = true;
          return;
        } else if (this.seenClear) {
          const strippedLines = stripAnsi(data)
            .split("\r")
            .filter(
              (line) =>
                line.trim().length > 0 &&
                line.trim() !== "%" &&
                line.trim() !== "⏎",
            );
          const lastLine = strippedLines[strippedLines.length - 1] || "";
          const lines = lastLine
            .split("\n")
            .filter(
              (line) =>
                line.trim().length > 0 &&
                line.trim() !== "%" &&
                line.trim() !== "⏎",
            );
          const commandPromptString = (lines[lines.length - 1] || "").trim();
          if (
            commandPromptString.length > 0 &&
            !commandPromptString.includes("echo")
          ) {
            this.runningClearToGetPrompt = false;
            this.seenClear = false;
            this.commandPromptString = commandPromptString;
            console.log(
              "Found command prompt string: " + this.commandPromptString,
            );
            if (this.resolveMeWhenCommandPromptStringFound) {
              this.resolveMeWhenCommandPromptStringFound(undefined);
            }
          }
          return;
        }
      }

      // Pass data through to terminal
      data = data.replace(/⏎[\s\S]+⏎/g, "").replace(/⏎/g, "");
      this.writeEmitter.fire(data);

      this.splitByCommandsListener(data);
      for (let listener of this.onDataListeners) {
        listener(data);
      }
    });

    process.on("exit", () => this.ptyProcess.kill());

    const newPty: vscode.Pseudoterminal = {
      onDidWrite: this.writeEmitter.event,
      open: () => {},
      close: () => {},
      handleInput: (data) => {
        this.ptyProcess.write(data);
      },
    };

    // Create and clear the terminal
    this.terminal = vscode.window.createTerminal({
      ...options,
      pty: newPty,
    });
    this.terminal.show();
  }
}
