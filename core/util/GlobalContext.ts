import fs from "node:fs";

import { ModelRole } from "@continuedev/config-yaml";

import { SiteIndexingConfig } from "..";
import {
  salvageSharedConfig,
  sharedConfigSchema,
  SharedConfigSchema,
} from "../config/sharedConfig";

import { getGlobalContextFilePath } from "./paths";

export type GlobalContextModelSelections = Partial<
  Record<ModelRole, string | null>
>;

export type GlobalContextType = {
  indexingPaused: boolean;
  lastSelectedProfileForWorkspace: {
    [workspaceIdentifier: string]: string | null;
  };
  lastSelectedOrgIdForWorkspace: {
    [workspaceIdentifier: string]: string | null;
  };
  selectedModelsByProfileId: {
    [profileId: string]: GlobalContextModelSelections;
  };

  /**
   * This is needed to handle the case where a JetBrains user has created
   * docs embeddings using one provider, and then updates to a new provider.
   *
   * For VS Code users, it is unnecessary since we use transformers.js by default.
   */
  hasDismissedConfigTsNoticeJetBrains: boolean;
  hasAlreadyCreatedAPromptFile: boolean;
  showConfigUpdateToast: boolean;
  isSupportedLanceDbCpuTargetForLinux: boolean;
  sharedConfig: SharedConfigSchema;
  failedDocs: SiteIndexingConfig[];
};

/**
 * A way to persist global state
 */
export class GlobalContext {
  update<T extends keyof GlobalContextType>(
    key: T,
    value: GlobalContextType[T],
  ) {
    const filepath = getGlobalContextFilePath();
    if (!fs.existsSync(filepath)) {
      fs.writeFileSync(
        filepath,
        JSON.stringify(
          {
            [key]: value,
          },
          null,
          2,
        ),
      );
    } else {
      const data = fs.readFileSync(filepath, "utf-8");

      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch (e: any) {
        console.warn(`Error updating global context: ${e}`);
        return;
      }

      parsed[key] = value;
      fs.writeFileSync(filepath, JSON.stringify(parsed, null, 2));
    }
  }

  get<T extends keyof GlobalContextType>(
    key: T,
  ): GlobalContextType[T] | undefined {
    const filepath = getGlobalContextFilePath();
    if (!fs.existsSync(filepath)) {
      return undefined;
    }

    const data = fs.readFileSync(filepath, "utf-8");
    try {
      const parsed = JSON.parse(data);
      return parsed[key];
    } catch (e: any) {
      console.warn(`Error parsing global context: ${e}`);
      return undefined;
    }
  }

  getSharedConfig(): SharedConfigSchema {
    const sharedConfig = this.get("sharedConfig") ?? {};
    const result = sharedConfigSchema.safeParse(sharedConfig);
    if (result.success) {
      return result.data;
    } else {
      // in case of damaged shared config, repair it
      // Attempt to salvage any values that are security concerns
      console.error("Failed to load shared config, salvaging...", result.error);
      const salvagedConfig = salvageSharedConfig(sharedConfig);
      this.update("sharedConfig", salvagedConfig);
      return salvagedConfig;
    }
  }

  updateSharedConfig(
    newValues: Partial<SharedConfigSchema>,
  ): SharedConfigSchema {
    const currentSharedConfig = this.getSharedConfig();
    const updatedSharedConfig = {
      ...currentSharedConfig,
      ...newValues,
    };
    this.update("sharedConfig", updatedSharedConfig);
    return updatedSharedConfig;
  }

  updateSelectedModel(
    profileId: string,
    role: ModelRole,
    title: string | null,
  ): GlobalContextModelSelections {
    const currentSelections = this.get("selectedModelsByProfileId") ?? {};
    const forProfile = currentSelections[profileId] ?? {};
    const newSelections = {
      ...forProfile,
      [role]: title,
    };

    this.update("selectedModelsByProfileId", {
      ...currentSelections,
      [profileId]: newSelections,
    });
    return newSelections;
  }
}
