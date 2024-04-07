import { ContinueConfig, ContinueRcJson, IDE, ILLM } from "..";
import { IdeSettings } from "../protocol";
import { Telemetry } from "../util/posthog";
import {
  BrowserSerializedContinueConfig,
  finalToBrowserConfig,
  loadFullConfigNode,
} from "./load";
import { fetchwithRequestOptions } from "../util/fetchWithOptions";

export class ConfigHandler {
  private savedConfig: ContinueConfig | undefined;
  private savedBrowserConfig?: BrowserSerializedContinueConfig;

  constructor(
    private readonly ide: IDE,
    private ideSettingsPromise: Promise<IdeSettings>,
    private readonly writeLog: (text: string) => void,
    private readonly onConfigUpdate: () => void
  ) {
    this.ide = ide;
    this.ideSettingsPromise = ideSettingsPromise;
    this.writeLog = writeLog;
    this.onConfigUpdate = onConfigUpdate;
    try {
      this.loadConfig();
    } catch (e) {
      console.error("Failed to load config: ", e);
    }
  }

  updateIdeSettings(ideSettings: IdeSettings) {
    this.ideSettingsPromise = Promise.resolve(ideSettings);
    this.reloadConfig();
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
    const ideSettings = await this.ideSettingsPromise;
    let remoteConfigServerUrl = undefined;
    try {
      remoteConfigServerUrl =
        typeof ideSettings.remoteConfigServerUrl !== "string" ||
        ideSettings.remoteConfigServerUrl === ""
          ? undefined
          : new URL(ideSettings.remoteConfigServerUrl);
    } catch (e) {}

    this.savedConfig = await loadFullConfigNode(
      this.ide.readFile,
      workspaceConfigs,
      remoteConfigServerUrl,
      ideInfo.ideType
    );
    this.savedConfig.allowAnonymousTelemetry =
      this.savedConfig.allowAnonymousTelemetry &&
      (await this.ide.isTelemetryEnabled());

    // Setup telemetry only after (and if) we know it is enabled
    await Telemetry.setup(
      this.savedConfig.allowAnonymousTelemetry ?? true,
      await this.ide.getUniqueId(),
      ideInfo.extensionVersion
    );

    return this.savedConfig;
  }

  setupLlm(llm: ILLM): ILLM {
    llm._fetch = async (input, init) => {
      const resp = await fetchwithRequestOptions(
        new URL(input),
        { ...init },
        llm.requestOptions
      );

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
