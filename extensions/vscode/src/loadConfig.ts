import { ContinueConfig, ILLM } from "core";
import defaultConfig from "core/config/default";
import { loadFullConfigNode } from "core/config/load";
import { getConfigJsonPath } from "core/util/paths";
import { https } from "follow-redirects";
import * as fs from "fs";
import fetch from "node-fetch";
import * as vscode from "vscode";
import { webviewRequest } from "./debugPanel";
const tls = require("tls");

const outputChannel = vscode.window.createOutputChannel(
  "Continue - LLM Prompt/Completion"
);

class VsCodeConfigHandler {
  savedConfig: ContinueConfig | undefined;

  reloadConfig() {
    this.savedConfig = undefined;
  }

  async loadConfig(): Promise<ContinueConfig> {
    try {
      if (this.savedConfig) {
        return this.savedConfig;
      }
      this.savedConfig = await loadFullConfigNode(ideProtocolClient.readFile);
      this.savedConfig.allowAnonymousTelemetry =
        this.savedConfig.allowAnonymousTelemetry &&
        vscode.workspace.getConfiguration("continue").get("telemetryEnabled");
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
      return defaultConfig;
    }
  }
}

export const configHandler = new VsCodeConfigHandler();

const TIMEOUT = 7200; // 7200 seconds = 2 hours

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

  const agent = new https.Agent({
    ca,
    rejectUnauthorized: llm.requestOptions?.verifySsl,
    timeout,
    sessionTimeout: timeout,
    keepAlive: true,
    keepAliveMsecs: timeout,
  });

  llm._fetch = async (input, init) => {
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
