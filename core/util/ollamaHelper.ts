import crypto from "crypto";
import { exec } from "node:child_process";
import path from "node:path";
import { IDE } from "..";

export interface ModelInfo {
    id: string;
    size: number;
    digest: string;
}

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

export async function getRemoteModelInfo(
    modelId: string,
    signal?: AbortSignal,
  ): Promise<ModelInfo | undefined> {
    const start = Date.now();
    const [modelName, tag = "latest"] = modelId.split(":");
    const url = `https://registry.ollama.ai/v2/library/${modelName}/manifests/${tag}`;
    try {
      const sig = signal ? signal : AbortSignal.timeout(3000);
      const response = await fetch(url, { signal: sig });

      if (!response.ok) {
        throw new Error(`Failed to fetch the model page: ${response.statusText}`);
      }

      // First, read the response body as an ArrayBuffer to compute the digest
      const buffer = await response.arrayBuffer();
      const digest = getDigest(buffer);

      // Then, decode the ArrayBuffer into a string and parse it as JSON
      const text = new TextDecoder().decode(buffer);
      const manifest = JSON.parse(text) as {
        config: { size: number };
        layers: { size: number }[];
      };
      const modelSize =
        manifest.config.size +
        manifest.layers.reduce((sum, layer) => sum + layer.size, 0);

      const data: ModelInfo = {
        id: modelId,
        size: modelSize,
        digest,
      };
      // Cache the successful result
      return data;
    } catch (error) {
      console.error(`Error fetching or parsing model info: ${error}`);
    } finally {
      const elapsed = Date.now() - start;
      console.log(`Fetched remote information for ${modelId} in ${elapsed} ms`);
    }
    return undefined;
  }

  function getDigest(buffer: ArrayBuffer): string {
    const hash = crypto.createHash("sha256");
    hash.update(new Uint8Array(buffer));
    return hash.digest("hex");
  }