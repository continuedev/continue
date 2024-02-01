import { ContinueConfig, IDE, ILLM } from "core";
import Ollama from "core/llm/llms/Ollama";
import * as fs from "fs";
import { Agent, ProxyAgent, fetch } from "undici";
import * as vscode from "vscode";
import { webviewRequest } from "./debugPanel";
import { VsCodeIde, loadFullConfigNode } from "./ideProtocol";
const tls = require("tls");

const outputChannel = vscode.window.createOutputChannel(
  "Continue - LLM Prompt/Completion"
);

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
        if (text.includes("try pulling it first")) {
          const model = JSON.parse(text).error.split(" ")[1].slice(1, -1);
          text = `The model "${model}" was not found. To download it, run \`ollama run ${model}\`.`;
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
  let config = await configHandler.loadConfig(new VsCodeIde());

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
    config = await configHandler.loadConfig(new VsCodeIde());
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
      const config = await configHandler.loadConfig(new VsCodeIde());
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
