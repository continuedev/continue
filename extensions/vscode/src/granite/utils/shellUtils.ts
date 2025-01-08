// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Terminal, env } from "vscode";
import { executeCommand } from "./cpUtils";

export enum WindowsShellType {
  CMD = "Command Prompt",
  POWER_SHELL = "PowerShell",
  GIT_BASH = "Git Bash",
  WSL = "WSL Bash",
  OTHERS = "Others"
}

export async function formattedPathForTerminal(filepath: string): Promise<string> {
  if (process.platform === "win32") {
      switch (currentWindowsShell()) {
          case WindowsShellType.WSL:
              return await toWslPath(filepath);
          default:
              return filepath;
      }
  } else {
      return filepath;
  }
}

export function getCommand(cmd: string): string {
  if (process.platform === "win32") {
      switch (currentWindowsShell()) {
          case WindowsShellType.POWER_SHELL:
              return `cmd /c ${cmd}`; // PowerShell
          default:
              return cmd; // others, try using common one.
      }
  } else {
      return cmd;
  }
}

export async function getCDCommand(cwd: string): Promise<string> {
  if (process.platform === "win32") {
      switch (currentWindowsShell()) {
          case WindowsShellType.GIT_BASH:
              return `cd "${cwd.replace(/\\+$/, "")}"`; // Git Bash: remove trailing '\'
          case WindowsShellType.POWER_SHELL: {
              // Escape '[' and ']' in PowerShell
              // See: https://github.com/microsoft/vscode-maven/issues/324
              const escaped: string = cwd.replace(/([[]])/g, "``$1");
              return `cd "${escaped}"`; // PowerShell
          }
          case WindowsShellType.CMD:
              return `cd /d "${cwd}"`; // CMD
          case WindowsShellType.WSL:
              return `cd "${await toWslPath(cwd)}"`; // WSL
          default:
              return `cd "${cwd}"`; // Unknown, try using common one.
      }
  } else {
      return `cd "${cwd}"`;
  }
}

export function currentWindowsShell(): WindowsShellType {
  const currentWindowsShellPath: string = env.shell;

  if (currentWindowsShellPath.endsWith("cmd.exe")) {
      return WindowsShellType.CMD;
  } else if (currentWindowsShellPath.endsWith("powershell.exe")) {
      return WindowsShellType.POWER_SHELL;
  } else if (currentWindowsShellPath.endsWith("bash.exe") || currentWindowsShellPath.endsWith("wsl.exe")) {
      if (currentWindowsShellPath.includes("Git")) {
          return WindowsShellType.GIT_BASH;
      }
      return WindowsShellType.WSL;
  } else {
      return WindowsShellType.OTHERS;
  }
}

function toDefaultWslPath(p: string): string {
  const arr: string[] = p.split(":\\");
  if (arr.length === 2) {
      const drive: string = arr[0].toLowerCase();
      const dir: string = arr[1].replace(/\\/g, "/");
      return `/mnt/${drive}/${dir}`;
  } else {
      return p.replace(/\\/g, "/");
  }
}

async function toWslPath(path: string): Promise<string> {
  try {
      return (await executeCommand("wsl", ["wslpath", "-u", `"${path.replace(/\\/g, "/")}"`])).trim();
  } catch (error) {
    return toDefaultWslPath(path);
  }
}

export function setupEnvForWSL(terminal: Terminal, env: { [envKey: string]: string }): void {
  if (terminal) {
      Object.keys(env).forEach(key => {
          terminal.sendText(`export ${key}="${env[key]}"`, true);
      });
  }
}
