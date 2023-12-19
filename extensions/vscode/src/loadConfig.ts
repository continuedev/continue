import { ContinueConfig, IDE, ILLM } from "core";
import https from "https";
import fetch from "node-fetch";
import { VsCodeIde, loadFullConfigNode } from "./ideProtocol";

class VsCodeConfigHandler {
  savedConfig: ContinueConfig | undefined;

  reloadConfig() {
    this.savedConfig = undefined;
  }

  async loadConfig(ide: IDE): Promise<ContinueConfig> {
    if (this.savedConfig) {
      return this.savedConfig;
    }
    this.savedConfig = await loadFullConfigNode(ide);
    return this.savedConfig;
  }
}

export const configHandler = new VsCodeConfigHandler();

export async function llmFromTitle(title: string): Promise<ILLM> {
  const config = await configHandler.loadConfig(new VsCodeIde());
  const llm = config.models.find((llm) => llm.title === title);
  if (!llm) {
    throw new Error(`Unknown model ${title}`);
  }

  if (llm.requestOptions) {
    // Since we know this is happening in Node.js, we can add requestOptions through a custom agent
    llm._fetch = async (input: any, init?: any) => {
      const agent = new https.Agent({
        ca: llm.requestOptions?.caBundlePath,
        // key: llm.requestOptions?.keyPath,
        rejectUnauthorized: llm.requestOptions?.verifySsl,
        timeout: llm.requestOptions?.timeout,
      });

      return fetch(input, {
        ...init,
        agent,
        headers: {
          ...init?.headers,
          ...llm.requestOptions?.headers,
        },
      });
    };
  }

  return llm;
}
