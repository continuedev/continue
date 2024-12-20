import {
  BrowserSerializedContinueConfig,
  ContinueConfig,
  IContextProvider,
} from "../index.js";

import { ConfigResult, finalToBrowserConfig } from "./load.js";
import { IProfileLoader } from "./profile/IProfileLoader.js";

export interface ProfileDescription {
  title: string;
  id: string;
}

export class ProfileLifecycleManager {
  private savedConfig: ConfigResult<ContinueConfig> | undefined;
  private savedBrowserConfig?: BrowserSerializedContinueConfig;
  private pendingConfigPromise?: Promise<ConfigResult<ContinueConfig>>;

  constructor(private readonly profileLoader: IProfileLoader) {}

  get profileId() {
    return this.profileLoader.profileId;
  }

  get profileTitle() {
    return this.profileLoader.profileTitle;
  }

  get profileDescription(): ProfileDescription {
    return {
      title: this.profileTitle,
      id: this.profileId,
    };
  }

  clearConfig() {
    this.savedConfig = undefined;
    this.savedBrowserConfig = undefined;
    this.pendingConfigPromise = undefined;
  }

  // Clear saved config and reload
  async reloadConfig(): Promise<ConfigResult<ContinueConfig>> {
    this.savedConfig = undefined;
    this.savedBrowserConfig = undefined;
    this.pendingConfigPromise = undefined;

    return this.loadConfig([], true);
  }

  async loadConfig(
    additionalContextProviders: IContextProvider[],
    forceReload: boolean = false,
  ): Promise<ConfigResult<ContinueConfig>> {
    // If we already have a config, return it
    if (!forceReload) {
      if (this.savedConfig) {
        return this.savedConfig;
      } else if (this.pendingConfigPromise) {
        return this.pendingConfigPromise;
      }
    }

    // Set pending config promise
    this.pendingConfigPromise = new Promise(async (resolve, reject) => {
      const result = await this.profileLoader.doLoadConfig();

      if (result.config) {
        // Add registered context providers
        result.config.contextProviders = (
          result.config.contextProviders ?? []
        ).concat(additionalContextProviders);

        this.savedConfig = result;
        resolve(result);
      } else if (result.errors) {
        reject(
          `Error in config.json: ${result.errors.map((item) => item.message).join(" | ")}`,
        );
      }
    });

    // Wait for the config promise to resolve
    this.savedConfig = await this.pendingConfigPromise;
    this.pendingConfigPromise = undefined;
    return this.savedConfig;
  }

  async getSerializedConfig(
    additionalContextProviders: IContextProvider[],
  ): Promise<ConfigResult<BrowserSerializedContinueConfig>> {
    if (!this.savedBrowserConfig) {
      const result = await this.loadConfig(additionalContextProviders);
      if (!result.config) {
        return {
          ...result,
          config: undefined,
        };
      }
      this.savedBrowserConfig = finalToBrowserConfig(result.config);
    }
    return {
      config: this.savedBrowserConfig,
      errors: [],
      configLoadInterrupted: false,
    };
  }
}
