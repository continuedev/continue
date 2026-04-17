import type { TerminalOptions } from "core";
import * as vscode from "vscode";

const REMOTE_TERMINAL_TIMEOUT_MS = 5000;

const terminalCacheByName = new Map<string, vscode.Terminal>();

function getNewActiveTerminal(
  existingTerminals: Set<vscode.Terminal>,
): vscode.Terminal | undefined {
  const activeTerminal = vscode.window.activeTerminal;
  if (!activeTerminal || existingTerminals.has(activeTerminal)) {
    return undefined;
  }

  return activeTerminal;
}

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
  await vscode.commands.executeCommand("workbench.action.terminal.new");

  const newActiveTerminal = getNewActiveTerminal(existingTerminals);
  if (newActiveTerminal) {
    return newActiveTerminal;
  }

  return await new Promise<vscode.Terminal>((resolve, reject) => {
    let settled = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      terminalOpenListener.dispose();
      activeTerminalListener.dispose();
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    };

    const resolveIfNewActiveTerminalExists = () => {
      const newTerminal = getNewActiveTerminal(existingTerminals);
      if (!newTerminal) {
        return false;
      }

      settled = true;
      cleanup();
      resolve(newTerminal);
      return true;
    };

    const terminalOpenListener = vscode.window.onDidOpenTerminal(() => {
      if (settled) {
        return;
      }

      resolveIfNewActiveTerminalExists();
    });

    const activeTerminalListener = vscode.window.onDidChangeActiveTerminal(
      (terminal) => {
        if (settled || !terminal || existingTerminals.has(terminal)) {
          return;
        }

        settled = true;
        cleanup();
        resolve(terminal);
      },
    );

    if (resolveIfNewActiveTerminalExists()) {
      return;
    }

    // `workbench.action.terminal.new` should focus the new terminal in remote
    // workspaces. If another terminal opens concurrently, wait until VS Code
    // actually switches the active terminal instead of grabbing the first one
    // that appears.
    timeoutHandle = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(new Error("Timed out waiting for remote terminal to open"));
    }, REMOTE_TERMINAL_TIMEOUT_MS);
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
