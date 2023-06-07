/* Terminal emulator - commented because node-pty is causing problems. */

import * as vscode from "vscode";
import os = require("os");
import stripAnsi from "strip-ansi";

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
    return os.userInfo().shell;
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

  private commandQueue: [string, (output: string) => void][] = [];
  private hasRunCommand: boolean = false;

  private async waitForCommandToFinish() {
    return new Promise<string>((resolve, reject) => {
      this.onDataListeners.push((data: any) => {
        const strippedData = stripAnsi(data);
        this.dataBuffer += strippedData;
        const lines = this.dataBuffer.split("\n");
        if (
          lines.length > 0 &&
          (lines[lines.length - 1].includes("bash-") ||
            lines[lines.length - 1].includes("(main)")) &&
          lines[lines.length - 1].includes("$")
        ) {
          resolve(this.dataBuffer);
          this.dataBuffer = "";
          this.onDataListeners = [];
        }
      });
    });
  }

  async runCommand(command: string): Promise<string> {
    if (!this.hasRunCommand) {
      this.hasRunCommand = true;
      // Let the first bash- prompt appear and let python env be opened
      await this.waitForCommandToFinish();
    }

    if (this.commandQueue.length === 0) {
      return new Promise(async (resolve, reject) => {
        this.commandQueue.push([command, resolve]);

        while (this.commandQueue.length > 0) {
          const [command, resolve] = this.commandQueue.shift()!;

          this.terminal.sendText(command);
          resolve(await this.waitForCommandToFinish());
        }
      });
    } else {
      return new Promise((resolve, reject) => {
        this.commandQueue.push([command, resolve]);
      });
    }
  }

  private readonly writeEmitter: vscode.EventEmitter<string>;

  constructor(terminalName: string) {
    this.shellCmd = "bash"; // getDefaultShell();

    const env = { ...(process.env as any) };
    if (os.platform() !== "win32") {
      env.PATH += `:${["/opt/homebrew/bin", "/opt/homebrew/sbin"].join(":")}`;
    }

    // Create the pseudo terminal
    this.ptyProcess = pty.spawn(this.shellCmd, [], {
      name: "xterm-256color",
      cols: 160, // TODO: Get size of vscode terminal, and change with resize
      rows: 26,
      cwd: getRootDir(),
      env,
      useConpty: true,
    });

    this.writeEmitter = new vscode.EventEmitter<string>();

    this.ptyProcess.onData((data: any) => {
      // Pass data through to terminal
      this.writeEmitter.fire(data);

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
      name: terminalName,
      pty: newPty,
    });
    this.terminal.show();
  }
}
