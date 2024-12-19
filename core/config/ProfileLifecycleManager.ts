import {
  BrowserSerializedContinueConfig,
  ContinueConfig,
  IContextProvider,
  IdeSettings,
} from "../index.js";

import { ConfigResult, finalToBrowserConfig } from "./load.js";
import { IProfileLoader } from "./profile/IProfileLoader.js";

export interface ProfileDescription {
  title: string;
  id: string;
}

export class ProfileLifecycleManager {
  private savedConfig: ContinueConfig | undefined;
  private savedBrowserConfig?: BrowserSerializedContinueConfig;
  private pendingConfigPromise?: Promise<ContinueConfig>;

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
  async reloadConfig(ideSettingsPromise: Promise<IdeSettings>): Promise<ConfigResult<ContinueConfig>> {
    this.savedConfig = undefined;
    this.savedBrowserConfig = undefined;
    this.pendingConfigPromise = undefined;

    return this.profileLoader.doLoadConfig(ideSettingsPromise);
  }

  async loadConfig(
    ideSettingsPromise: Promise<IdeSettings>,
    additionalContextProviders: IContextProvider[],
  ): Promise<ContinueConfig> {
    // If we already have a config, return it
    if (this.savedConfig) {
      return this.savedConfig;
    } else if (this.pendingConfigPromise) {
      return this.pendingConfigPromise;
    }

    // Set pending config promise
    this.pendingConfigPromise = new Promise(async (resolve, reject) => {
      const { config: newConfig, errors } =
        await this.profileLoader.doLoadConfig(ideSettingsPromise);

      if (newConfig) {
        // Add registered context providers
        newConfig.contextProviders = (newConfig.contextProviders ?? []).concat(
          additionalContextProviders,
        );

        this.savedConfig = newConfig;
        resolve(newConfig);
      } else if (errors) {
        reject(
          `Error in config.json: ${errors.map((item) => item.message).join(" | ")}`,
        );
      }
    });

    // Wait for the config promise to resolve
    this.savedConfig = await this.pendingConfigPromise;
    this.pendingConfigPromise = undefined;
    return this.savedConfig;
  }

  async getSerializedConfig(
    ideSettingsPromise: Promise<IdeSettings>,
    additionalContextProviders: IContextProvider[],
  ): Promise<BrowserSerializedContinueConfig> {
    if (!this.savedBrowserConfig) {
      const continueConfig = await this.loadConfig(ideSettingsPromise, additionalContextProviders);
      this.savedBrowserConfig = finalToBrowserConfig(continueConfig);
    }
    return this.savedBrowserConfig;
  }
}
