// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as cp from "child_process";
import * as vscode from "vscode";

export async function executeCommand(command: string, args: string[], options: cp.SpawnOptions = { shell: true }, token?: vscode.CancellationToken, progressCallback?: (progress: string) => void): Promise<string> {
    return new Promise((resolve: (res: string) => void, reject: (e: Error) => void): void => {
        let result = "";
        const childProc: cp.ChildProcess = cp.spawn(command, args, options);
        //let killed = false;
        if (token) {
            token.onCancellationRequested(() => {
                console.error(`Killing ${command} !!!`);
                childProc.kill();
                //killed = true;
                reject(new Error(`Command "${command} ${args.toString()}" was cancelled.`));
            });
        }
        childProc.stdout?.on("data", (data: string | Buffer) => {
            data = data.toString();
            //console.log(data);
            result = result.concat(data);
        });
        childProc.stderr?.on("data", (data: string | Buffer) => {
            data = data.toString();
            // Extract and report progress
            if (progressCallback) {
                progressCallback(data);
            }
            //console.error(data);
            result = result.concat(data);
        });
        childProc.on("error", reject);
        childProc.on("close", (code: number) => {
            if (code !== 0 || result.indexOf("ERROR") > -1) {
                console.error(result);
                reject(new Error(`Command "${command} ${args.toString()}" failed with exit code "${code}".`));
            } else {
                resolve(result);
            }
        });
    });
}
