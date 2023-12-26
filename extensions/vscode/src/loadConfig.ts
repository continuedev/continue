import { ContinueConfig, IDE, ILLM } from "core";
import * as fs from "fs";
import { Agent, fetch } from "undici";
import { VsCodeIde, loadFullConfigNode } from "./ideProtocol";
const tls = require("tls");

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
    const ca = [...tls.rootCertificates];
    const customCerts =
      typeof llm.requestOptions?.caBundlePath === "string"
        ? [llm.requestOptions?.caBundlePath]
        : llm.requestOptions?.caBundlePath;
    if (customCerts) {
      ca.push(
        ...customCerts.map((customCert) => fs.readFileSync(customCert, "utf8"))
      );
    }

    const agent = new Agent({
      connect: {
        ca,
        rejectUnauthorized: llm.requestOptions?.verifySsl,
        timeout: llm.requestOptions?.timeout,
      },
    });

    llm._fetch = (input, init) => {
      const headers: { [key: string]: string } =
        llm.requestOptions?.headers || {};
      for (const [key, value] of Object.entries(init?.headers || {})) {
        headers[key] = value as string;
      }

      return fetch(input, {
        ...init,
        dispatcher: agent,
        headers,
      });
    };
  }

  return llm;
}
