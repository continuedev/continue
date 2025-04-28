import {
  ConfigResult,
  ConfigValidationError,
  FullSlug,
} from "@continuedev/config-yaml";

import {
  BrowserSerializedContinueConfig,
  ContinueConfig,
  IContextProvider,
  IDE,
} from "../index.js";

import { finalToBrowserConfig } from "./load.js";
import { IProfileLoader } from "./profile/IProfileLoader.js";

export interface ProfileDescription {
  fullSlug: FullSlug;
  profileType: "control-plane" | "local" | "platform";
  title: string;
  id: string;
  iconUrl: string;
  errors: ConfigValidationError[] | undefined;
  uri: string;
  rawYaml?: string;
}

export interface OrganizationDescription {
  id: string;
  iconUrl: string;
  name: string;
  slug: string | undefined; // TODO: This doesn't need to be undefined, just doing while transitioning the backend
}

export type OrgWithProfiles = OrganizationDescription & {
  profiles: ProfileLifecycleManager[];
  currentProfile: ProfileLifecycleManager | null;
};

export type SerializedOrgWithProfiles = OrganizationDescription & {
  profiles: ProfileDescription[];
  selectedProfileId: string | null;
};

export class ProfileLifecycleManager {
  private savedConfigResult: ConfigResult<ContinueConfig> | undefined;
  private savedBrowserConfigResult?: ConfigResult<BrowserSerializedContinueConfig>;
  private pendingConfigPromise?: Promise<ConfigResult<ContinueConfig>>;

  constructor(
    private readonly profileLoader: IProfileLoader,
    private readonly ide: IDE,
  ) {}

  get profileDescription(): ProfileDescription {
    return this.profileLoader.description;
  }

  clearConfig() {
    this.savedConfigResult = undefined;
    this.savedBrowserConfigResult = undefined;
    this.pendingConfigPromise = undefined;
  }

  // Clear saved config and reload
  async reloadConfig(
    additionalContextProviders: IContextProvider[] = [],
  ): Promise<ConfigResult<ContinueConfig>> {
    this.savedConfigResult = undefined;
    this.savedBrowserConfigResult = undefined;
    this.pendingConfigPromise = undefined;

    return this.loadConfig(additionalContextProviders, true);
  }

  async loadConfig(
    additionalContextProviders: IContextProvider[],
    forceReload: boolean = false,
  ): Promise<ConfigResult<ContinueConfig>> {
    // If we already have a config, return it
    if (!forceReload) {
      if (this.savedConfigResult) {
        return this.savedConfigResult;
      } else if (this.pendingConfigPromise) {
        return this.pendingConfigPromise;
      }
    }

    // Set pending config promise
    this.pendingConfigPromise = new Promise(async (resolve, reject) => {
      let result: ConfigResult<ContinueConfig>;
      // This try catch is expected to catch high-level errors that aren't block-specific
      // Like invalid json, invalid yaml, file read errors, etc.
      // NOT block-specific loading errors
      try {
        result = await this.profileLoader.doLoadConfig();
      } catch (e) {
        const message =
          e instanceof Error
            ? `${e.message}\n${e.stack ? e.stack : ""}`
            : "Error loading config";
        result = {
          errors: [
            {
              fatal: true,
              message,
            },
          ],
          config: undefined,
          configLoadInterrupted: true,
        };
      }

      if (result.config) {
        // Add registered context providers
        result.config.contextProviders = (
          result.config.contextProviders ?? []
        ).concat(additionalContextProviders);
      }

      resolve(result);
    });

    // Wait for the config promise to resolve
    this.savedConfigResult = await this.pendingConfigPromise;
    this.pendingConfigPromise = undefined;
    return this.savedConfigResult;
  }

  async getSerializedConfig(
    additionalContextProviders: IContextProvider[],
  ): Promise<ConfigResult<BrowserSerializedContinueConfig>> {
    if (this.savedBrowserConfigResult) {
      return this.savedBrowserConfigResult;
    } else {
      const result = await this.loadConfig(additionalContextProviders);
      if (!result.config) {
        return {
          ...result,
          config: undefined,
        };
      }
      const serializedConfig = await finalToBrowserConfig(
        result.config,
        this.ide,
      );
      return {
        ...result,
        config: serializedConfig,
      };
    }
  }
}
