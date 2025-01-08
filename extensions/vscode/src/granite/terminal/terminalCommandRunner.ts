
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Disposable, Terminal, window } from "vscode";

export interface ITerminalOptions {
    addNewLine?: boolean;
    name: string;
    cwd?: string;
    env?: { [key: string]: string },
    show?: boolean;
}

class TerminalCommandRunner implements Disposable {
    private readonly terminals: { [id: string]: Terminal } = {};

    public async runInTerminal(command: string, options: ITerminalOptions): Promise<Terminal> {

        let terminal: Terminal | undefined;
        const name = options.name;
        if (window.terminals.length) {
            terminal = window.terminals.find(t => name === t.name);
        }

        if (!terminal) {
            terminal = window.createTerminal(name);
        }
        terminal.show();
        terminal.sendText(command);

        // const defaultOptions = { addNewLine: true, show: true };
        // const { addNewLine, name, cwd, show } = Object.assign(defaultOptions, options);
        // let terminal = this.terminals[name];
        // if (terminal === undefined) {
        //     const env: { [envKey: string]: string } = { ...options.env };
        //     terminal = window.createTerminal({ name, env });
        //     this.terminals[name] = terminal;
        //     // Workaround for WSL custom envs.
        //     // See: https://github.com/Microsoft/vscode/issues/71267
        //     if (currentWindowsShell() === WindowsShellType.WSL) {
        //         setupEnvForWSL(terminal, env);
        //     }
        // }
        // if (show) {
        //     terminal.show();
        // }
        // if (cwd) {
        //     terminal.sendText(await getCDCommand(cwd), true);
        // }
        // terminal.sendText(getCommand(command), addNewLine);
        return terminal;
    }

    public closeAllTerminals(): void {
        Object.keys(this.terminals).forEach((id: string) => {
            this.terminals[id].dispose();
            delete this.terminals[id];
        });
    }

    public dispose(terminalName?: string): void {
        if (terminalName && this.terminals[terminalName] !== undefined) {
            this.terminals[terminalName].dispose();
            delete this.terminals[terminalName];
        } else {
            Object.keys(this.terminals).forEach((id: string) => {
                this.terminals[id].dispose();
                delete this.terminals[id];
            });
        }
    }
}

export const terminalCommandRunner: TerminalCommandRunner = new TerminalCommandRunner();
