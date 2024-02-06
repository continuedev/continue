/**
 * 2024-02 Modified by Lukas Prediger, Copyright (c) 2023 CSC - IT Center for Science Ltd.
 */

import { ContinueConfig, CustomLLM, IDE, ILLM } from "core";
import * as fs from "fs";
import { Agent, ProxyAgent, fetch } from "undici";
import * as vscode from "vscode";
import { webviewRequest } from "./debugPanel";
import { VsCodeIde, loadFullConfigNode } from "./ideProtocol";
import { EventEmitter } from "vscode";
import { injectExtensionModelsToFinalConfig } from "core/config/load";
const tls = require("tls");

const outputChannel = vscode.window.createOutputChannel(
  "Continue - LLM Prompt/Completion"
);

export interface ExtensionModelsChangeEvent {
  readonly added?: readonly string[];
  readonly removed?: readonly string[];
}

export interface ConfigChangeEvent {
  readonly config: ContinueConfig;
}

class VsCodeConfigHandler {
  savedConfig: ContinueConfig | undefined;

  savedConfigWithExtensionModels: ContinueConfig | undefined;
  private extensionModels: CustomLLM[];
  private extensionModelsChangeEventEmitter: EventEmitter<ExtensionModelsChangeEvent>;
  private configChangeEventEmitter: EventEmitter<ConfigChangeEvent>;

  constructor() {
    this.extensionModels = [];
    this.extensionModelsChangeEventEmitter = new EventEmitter<ExtensionModelsChangeEvent>();
    this.configChangeEventEmitter = new EventEmitter<ConfigChangeEvent>();
  }

  addExtensionModel(customLLM: CustomLLM) {
    if (!customLLM.options?.title) {
      throw new Error("The custom model must define a unique title.")
    }
    if (this.savedConfig?.models.some(knownModel => knownModel.title === customLLM.options?.title)) {
      throw new Error("The title is already taken by another model.")
    }

    this.extensionModels.push(customLLM);
    this.extensionModelsChangeEventEmitter.fire({
      added: [customLLM.options.title],
    })

    if (this.savedConfig) {
      this.savedConfigWithExtensionModels = injectExtensionModelsToFinalConfig(this.savedConfig, this.extensionModels);
      this.fireConfigChanged();
    }
  }

  removeExtensionModel(title: string): boolean {
    const customLLM = this.extensionModels.find(knownModel => knownModel.options?.title === title);
    if (customLLM) {
      this.extensionModels = this.extensionModels.filter(knownModel => knownModel.options?.title !== title);
      this.extensionModelsChangeEventEmitter.fire({
        removed: [title],
      });
      if (this.savedConfig) {
        this.savedConfigWithExtensionModels = injectExtensionModelsToFinalConfig(this.savedConfig, this.extensionModels);
        this.fireConfigChanged();
      }
      return true;
    }
    return false;
  }

  get onExtensionModelsChange() {
    return this.extensionModelsChangeEventEmitter.event;
  }

  get onConfigChanged() {
    return this.configChangeEventEmitter.event;
  }

  private fireConfigChanged() {
    if (this.savedConfigWithExtensionModels) {
      this.configChangeEventEmitter.fire({
        config: this.savedConfigWithExtensionModels
      });
    } else if (this.savedConfig) {
      this.configChangeEventEmitter.fire({
        config: this.savedConfig
      });
    }
  }

  async reloadConfig(ide: IDE) {
    this.savedConfig = undefined;
    this.savedConfigWithExtensionModels = undefined;
    await this.loadConfig(ide);
  }

  async loadConfig(ide: IDE): Promise<ContinueConfig> {
    if (this.savedConfigWithExtensionModels) {
      return this.savedConfigWithExtensionModels;
    }
    if (!this.savedConfig) {
      this.savedConfig = await loadFullConfigNode(ide);
    }
    this.savedConfigWithExtensionModels = injectExtensionModelsToFinalConfig(this.savedConfig, this.extensionModels);
    this.fireConfigChanged();
    return this.savedConfigWithExtensionModels;
  }

}

export const configHandler = new VsCodeConfigHandler();

const TIMEOUT = 7200; // 7200 seconds = 2 hours

export async function llmFromTitle(title?: string): Promise<ILLM> {
  const ide = new VsCodeIde();
  let config = await configHandler.loadConfig(ide);

  if (title === undefined) {
    const resp = await webviewRequest("getDefaultModelTitle");
    if (resp?.defaultModelTitle) {
      title = resp.defaultModelTitle;
    }
  }

  let llm = title
    ? config.models.find((llm) => llm.title === title)
    : config.models[0];
  if (!llm) {
    // Try to reload config
    await configHandler.reloadConfig(ide);
    config = await configHandler.loadConfig(ide);
    llm = config.models.find((llm) => llm.title === title);
    if (!llm) {
      throw new Error(`Unknown model ${title}`);
    }
  }

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

  let timeout = (llm.requestOptions?.timeout || TIMEOUT) * 1000; // measured in ms

  const agent =
    llm.requestOptions?.proxy !== undefined
      ? new ProxyAgent({
          connect: {
            ca,
            rejectUnauthorized: llm.requestOptions?.verifySsl,
            timeout,
          },
          uri: llm.requestOptions?.proxy,
          bodyTimeout: timeout,
          connectTimeout: timeout,
          headersTimeout: timeout,
        })
      : new Agent({
          connect: {
            ca,
            rejectUnauthorized: llm.requestOptions?.verifySsl,
            timeout,
          },
          bodyTimeout: timeout,
          connectTimeout: timeout,
          headersTimeout: timeout,
        });

  llm._fetch = async (input, init) => {
    const headers: { [key: string]: string } =
      llm!.requestOptions?.headers || {};
    for (const [key, value] of Object.entries(init?.headers || {})) {
      headers[key] = value as string;
    }

    const resp = await fetch(input, {
      ...init,
      dispatcher: agent,
      headers,
    });

    if (!resp.ok) {
      let text = await resp.text();
      if (resp.status === 404 && !resp.url.includes("/v1")) {
        text =
          "This may mean that you forgot to add '/v1' to the end of your 'apiBase' in config.json.";
      }
      throw new Error(
        `HTTP ${resp.status} ${resp.statusText} from ${resp.url}\n\n${text}`
      );
    }

    return resp;
  };

  llm.writeLog = async (log: string) => {
    outputChannel.appendLine(
      "=========================================================================="
    );
    outputChannel.appendLine(
      "=========================================================================="
    );

    outputChannel.append(log);
  };

  return llm;
}
