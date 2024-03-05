import { http, https } from "follow-redirects";
import * as fs from "fs";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import fetch from "node-fetch";
import { ContinueConfig, ContinueRcJson, IDE, ILLM } from "..";
import { Telemetry } from "../util/posthog";
import {
  BrowserSerializedContinueConfig,
  finalToBrowserConfig,
  loadFullConfigNode,
} from "./load";
const tls = require("tls");
export class ConfigHandler {
  private savedConfig: ContinueConfig | undefined;
  private savedBrowserConfig?: BrowserSerializedContinueConfig;

  private readonly ide: IDE;
  private readonly remoteConfigServerUrl: URL | undefined;
  private readonly writeLog: (text: string) => void;
  private readonly onConfigUpdate: () => void;
  constructor(
    ide: IDE,
    remoteConfigServerUrl: URL | undefined,
    writeLog: (text: string) => void,
    onConfigUpdate: () => void,
  ) {
    this.ide = ide;
    this.remoteConfigServerUrl = remoteConfigServerUrl;
    this.writeLog = writeLog;
    this.onConfigUpdate = onConfigUpdate;
    try {
      this.loadConfig();
    } catch (e) {
      console.error("Failed to load config: ", e);
    }
  }

  reloadConfig() {
    this.savedConfig = undefined;
    this.savedBrowserConfig = undefined;
    this.loadConfig();
    this.onConfigUpdate();
  }

  async getSerializedConfig(): Promise<BrowserSerializedContinueConfig> {
    if (!this.savedBrowserConfig) {
      this.savedConfig = await this.loadConfig();
      this.savedBrowserConfig = finalToBrowserConfig(this.savedConfig);
    }
    return this.savedBrowserConfig;
  }

  async loadConfig(): Promise<ContinueConfig> {
    try {
      if (this.savedConfig) {
        return this.savedConfig;
      }

      let workspaceConfigs: ContinueRcJson[] = [];
      try {
        workspaceConfigs = await this.ide.getWorkspaceConfigs();
      } catch (e) {
        console.warn("Failed to load workspace configs");
      }

      const ideInfo = await this.ide.getIdeInfo();
      this.savedConfig = await loadFullConfigNode(
        this.ide.readFile,
        workspaceConfigs,
        this.remoteConfigServerUrl,
        ideInfo.ideType,
      );
      this.savedConfig.allowAnonymousTelemetry =
        this.savedConfig.allowAnonymousTelemetry &&
        (await this.ide.isTelemetryEnabled());

      // Setup telemetry only after (and if) we know it is enabled
      await Telemetry.setup(
        this.savedConfig.allowAnonymousTelemetry ?? true,
        await this.ide.getUniqueId(),
      );

      return this.savedConfig;
    } catch (e: any) {
      console.error("Failed to loadConfig: ", e.message);
      throw new Error("Failed to loadConfig: " + e.message);
    }
  }

  setupLlm(llm: ILLM): ILLM {
    const TIMEOUT = 7200; // 7200 seconds = 2 hours
    // Since we know this is happening in Node.js, we can add requestOptions through a custom agent
    const ca = [...tls.rootCertificates];
    const customCerts =
      typeof llm.requestOptions?.caBundlePath === "string"
        ? [llm.requestOptions?.caBundlePath]
        : llm.requestOptions?.caBundlePath;
    if (customCerts) {
      ca.push(
        ...customCerts.map((customCert) => fs.readFileSync(customCert, "utf8")),
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

      // Replace localhost with 127.0.0.1
      input = new URL(input);
      if (input.hostname === "localhost") {
        input.hostname = "127.0.0.1";
      }

      let updatedBody: string | undefined = undefined;
      try {
        if (
          llm.requestOptions?.extraBodyProperties &&
          typeof init.body === "string"
        ) {
          const parsedBody = JSON.parse(init.body);
          updatedBody = JSON.stringify({
            ...parsedBody,
            ...llm.requestOptions.extraBodyProperties,
          });
        }
      } catch (e) {
        console.log("Unable to parse HTTP request body: ", e);
      }

      const resp = await fetch(input, {
        ...init,
        body: updatedBody ?? init.body,
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
          `HTTP ${resp.status} ${resp.statusText} from ${resp.url}\n\n${text}`,
        );
      }

      return resp;
    };

    llm.writeLog = async (log: string) => {
      this.writeLog(log);
    };
    return llm;
  }

  async llmFromTitle(title?: string): Promise<ILLM> {
    const config = await this.loadConfig();
    const model =
      config.models.find((m) => m.title === title) || config.models[0];
    if (!model) {
      throw new Error("No model found");
    }

    return this.setupLlm(model);
  }
}
