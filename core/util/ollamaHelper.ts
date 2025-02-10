import path from "node:path";
import { IDE } from "..";
import { exec } from "node:child_process";

export async function isOllamaInstalled(): Promise<boolean> {
    return new Promise((resolve, _reject) => {
        const command = process.platform === "win32" ? "where.exe ollama" : "which ollama";
        exec(command, (error, _stdout, _stderr) => {
            resolve(!error);
        });
    });
}

export async function startLocalOllama(ide: IDE): Promise<any> {
    let startCommand: string | undefined;

    switch (process.platform) {
        case "darwin"://MacOS
            startCommand = "open -a Ollama.app\n";
            break;

        case "win32"://Windows
            startCommand = "& \"ollama app.exe\"\n";
            break;

        default: //Linux...
            const start_script_path = path.resolve(__dirname, "./start_ollama.sh");
            if (await ide.fileExists(`file:/${start_script_path}`)) {
                startCommand = `set -e && chmod +x ${start_script_path} && ${start_script_path}\n`;
                console.log(`Ollama Linux startup script at : ${start_script_path}`);
            } else {
                return ide.showToast("error", `Cannot start Ollama: could not find ${start_script_path}!`)
            }
    }
    if (startCommand) {
        return ide.runCommand(startCommand, {
            reuseTerminal: true,
            terminalName: "Start Ollama"
        });
    }
}
