import type { TerminalOptions } from "core";
import * as vscode from "vscode";

const REMOTE_TERMINAL_TIMEOUT_MS = 5000;

const terminalCacheByName = new Map<string, vscode.Terminal>();

function getReusableTerminal(
  options: TerminalOptions,
): vscode.Terminal | undefined {
  if (!vscode.window.terminals.length || !options.reuseTerminal) {
    return undefined;
  }

  if (options.terminalName) {
    const cachedTerminal = terminalCacheByName.get(options.terminalName);
    if (cachedTerminal && vscode.window.terminals.includes(cachedTerminal)) {
      return cachedTerminal;
    }

    terminalCacheByName.delete(options.terminalName);
    return vscode.window.terminals.find(
      (terminal) => terminal?.name === options.terminalName,
    );
  }

  return vscode.window.activeTerminal ?? vscode.window.terminals[0];
}

async function createTerminal(
  options: TerminalOptions,
): Promise<vscode.Terminal> {
  if (!vscode.env.remoteName) {
    return vscode.window.createTerminal(options.terminalName);
  }

  const existingTerminals = new Set(vscode.window.terminals);

  return await new Promise<vscode.Terminal>((resolve, reject) => {
    let settled = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      terminalListener.dispose();
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    };

    const resolveIfNewTerminalExists = () => {
      const newTerminal = vscode.window.terminals.find(
        (terminal) => !existingTerminals.has(terminal),
      );
      if (!newTerminal) {
        return false;
      }

      settled = true;
      cleanup();
      resolve(newTerminal);
      return true;
    };

    const terminalListener = vscode.window.onDidOpenTerminal((terminal) => {
      if (settled || existingTerminals.has(terminal)) {
        return;
      }

      settled = true;
      cleanup();
      resolve(terminal);
    });

    timeoutHandle = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(new Error("Timed out waiting for remote terminal to open"));
    }, REMOTE_TERMINAL_TIMEOUT_MS);

    if (resolveIfNewTerminalExists()) {
      return;
    }

    void vscode.commands.executeCommand("workbench.action.terminal.new").then(
      () => {
        resolveIfNewTerminalExists();
      },
      (error: unknown) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        reject(error);
      },
    );
  });
}

export async function runCommandInTerminal(
  command: string,
  options: TerminalOptions = { reuseTerminal: true },
): Promise<void> {
  const terminal =
    getReusableTerminal(options) ?? (await createTerminal(options));

  if (options.terminalName) {
    terminalCacheByName.set(options.terminalName, terminal);
  }

  terminal.show();
  terminal.sendText(command, true);
}
