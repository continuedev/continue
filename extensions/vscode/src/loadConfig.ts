import { ContinueConfig, ILLM, SerializedContinueConfig } from "core";
import defaultConfig from "core/config/default";
import {
  finalToBrowserConfig,
  intermediateToFinalConfig,
  loadFullConfigNode,
  serializedToIntermediateConfig,
} from "core/config/load";
import Ollama from "core/llm/llms/Ollama";
import { getConfigJsonPath } from "core/util/paths";
import { http, https } from "follow-redirects";
import * as fs from "fs";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import fetch from "node-fetch";
import * as path from "path";
import * as vscode from "vscode";
import { ideProtocolClient } from "./activation/activate";
import { debugPanelWebview, webviewRequest } from "./debugPanel";
const tls = require("tls");

const outputChannel = vscode.window.createOutputChannel(
  "Continue - LLM Prompt/Completion"
);

class VsCodeConfigHandler {
  savedConfig: ContinueConfig | undefined;

  reloadConfig() {
    this.savedConfig = undefined;
    this.loadConfig();
  }

  private async _getWorkspaceConfigs() {
    const workspaceDirs = await ideProtocolClient.getWorkspaceDirectories();
    const configs: Partial<SerializedContinueConfig>[] = [];
    for (const workspaceDir of workspaceDirs) {
      const files = await vscode.workspace.fs.readDirectory(
        vscode.Uri.file(workspaceDir)
      );
      for (const [filename, type] of files) {
        if (type === vscode.FileType.File && filename === ".continuerc.json") {
          const contents = await ideProtocolClient.readFile(
            path.join(workspaceDir, filename)
          );
          configs.push(JSON.parse(contents));
        }
      }
    }
    return configs;
  }

  async loadConfig(): Promise<ContinueConfig> {
    try {
      if (this.savedConfig) {
        return this.savedConfig;
      }
      this.savedConfig = await loadFullConfigNode(
        ideProtocolClient.readFile,
        await this._getWorkspaceConfigs()
      );
      this.savedConfig.allowAnonymousTelemetry =
        this.savedConfig.allowAnonymousTelemetry &&
        vscode.workspace.getConfiguration("continue").get("telemetryEnabled");

      // Update the sidebar panel
      const browserConfig = finalToBrowserConfig(this.savedConfig);
      debugPanelWebview?.postMessage({ type: "configUpdate", browserConfig });

      return this.savedConfig;
    } catch (e) {
      vscode.window
        .showErrorMessage(
          "Error loading config.json. Please check your config.json file: " + e,
          "Open config.json"
        )
        .then((selection) => {
          if (selection === "Open config.json") {
            vscode.workspace
              .openTextDocument(getConfigJsonPath())
              .then((doc) => {
                vscode.window.showTextDocument(doc);
              });
          }
        });
      return intermediateToFinalConfig(
        serializedToIntermediateConfig(defaultConfig),
        ideProtocolClient.readFile
      );
    }
  }
}

export const configHandler = new VsCodeConfigHandler();

const TIMEOUT = 7200; // 7200 seconds = 2 hours

function setupLlm(llm: ILLM): ILLM {
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

  const agentOptions = {
    ca,
    rejectUnauthorized: llm.requestOptions?.verifySsl,
    timeout,
    sessionTimeout: timeout,
    keepAlive: true,
    keepAliveMsecs: timeout,
  };

  const proxy = llm.requestOptions?.proxy;

  llm._fetch = async (input, init) => {
    // Create agent
    const protocol = new URL(input).protocol === "https:" ? https : http;
    const agent = proxy
      ? new URL(input).protocol === "https:"
        ? new HttpsProxyAgent(proxy, agentOptions)
        : new HttpProxyAgent(proxy, agentOptions)
      : new protocol.Agent(agentOptions);

    const headers: { [key: string]: string } =
      llm!.requestOptions?.headers || {};
    for (const [key, value] of Object.entries(init?.headers || {})) {
      headers[key] = value as string;
    }

    const resp = await fetch(input, {
      ...init,
      headers,
      agent,
    });

    if (!resp.ok) {
      let text = await resp.text();
      if (resp.status === 404 && !resp.url.includes("/v1")) {
        if (text.includes("try pulling it first")) {
          const model = JSON.parse(text).error.split(" ")[1].slice(1, -1);
          text = `The model "${model}" was not found. To download it, run \`ollama run ${model}\`.`;
        } else if (text.includes("/api/chat")) {
          text =
            "The /api/chat endpoint was not found. This may mean that you are using an older version of Ollama that does not support /api/chat. Upgrading to the latest version will solve the issue.";
        } else {
          text =
            "This may mean that you forgot to add '/v1' to the end of your 'apiBase' in config.json.";
        }
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

export async function llmFromTitle(title?: string): Promise<ILLM> {
  let config = await configHandler.loadConfig();

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
    configHandler.reloadConfig();
    config = await configHandler.loadConfig();
    llm = config.models.find((llm) => llm.title === title);
    if (!llm) {
      throw new Error(`Unknown model ${title}`);
    }
  }

  return setupLlm(llm);
}

export class TabAutocompleteModel {
  private static _llm: ILLM | undefined;
  private static defaultTag: string = "deepseek-coder:1.3b-base";

  private static shownOllamaWarning: boolean = false;
  private static shownDeepseekWarning: boolean = false;

  static clearLlm() {
    TabAutocompleteModel._llm = undefined;
  }

  static async getDefaultTabAutocompleteModel() {
    const llm = new Ollama({
      model: TabAutocompleteModel.defaultTag,
    });

    // Check that deepseek is already downloaded
    try {
      const models = await llm.listModels();
      if (!models.includes(TabAutocompleteModel.defaultTag)) {
        // Raise warning and explain how to download
        if (!TabAutocompleteModel.shownDeepseekWarning) {
          vscode.window
            .showWarningMessage(
              `Your local Ollama instance doesn't yet have DeepSeek Coder. To download this model, run \`ollama run deepseek-coder:1.3b-base\` (recommended). If you'd like to use a custom model for tab autocomplete, learn more in the docs`,
              "Documentation",
              "Copy Command"
            )
            .then((value) => {
              if (value === "Documentation") {
                vscode.env.openExternal(
                  vscode.Uri.parse(
                    "https://continue.dev/docs/walkthroughs/tab-autocomplete"
                  )
                );
              } else if (value === "Copy Command") {
                vscode.env.clipboard.writeText(
                  "ollama run deepseek-coder:1.3b-base"
                );
              }
            });
          TabAutocompleteModel.shownDeepseekWarning = true;
        }
        return undefined;
      }
    } catch (e) {
      if (!TabAutocompleteModel.shownOllamaWarning) {
        vscode.window
          .showWarningMessage(
            "Continue failed to connect to Ollama, which is used by default for tab-autocomplete. If you haven't downloaded it yet, you can do so at https://ollama.ai (recommended). If you'd like to use a custom model for tab autocomplete, learn more in the docs",
            "Documentation"
          )
          .then((value) => {
            if (value === "Documentation") {
              vscode.env.openExternal(
                vscode.Uri.parse(
                  "https://continue.dev/docs/walkthroughs/tab-autocomplete"
                )
              );
            }
          });
        TabAutocompleteModel.shownOllamaWarning = true;
      }
      return undefined;
    }

    return llm;
  }

  static async get() {
    if (!TabAutocompleteModel._llm) {
      const config = await configHandler.loadConfig();
      if (config.tabAutocompleteModel) {
        TabAutocompleteModel._llm = setupLlm(config.tabAutocompleteModel);
      } else {
        TabAutocompleteModel._llm =
          await TabAutocompleteModel.getDefaultTabAutocompleteModel();
      }
    }

    return TabAutocompleteModel._llm;
  }
}
