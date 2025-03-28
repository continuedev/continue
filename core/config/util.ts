import fs from "fs";
import os from "os";

import {
  ContinueConfig,
  ExperimentalModelRoles,
  IDE,
  ILLM,
  ModelDescription,
} from "../";
import { GlobalContext } from "../util/GlobalContext";
import { editConfigFile } from "../util/paths";

function stringify(obj: any, indentation?: number): string {
  return JSON.stringify(
    obj,
    (key, value) => {
      return value === null ? undefined : value;
    },
    indentation,
  );
}

export function addModel(
  model: ModelDescription,
  role?: keyof ExperimentalModelRoles,
) {
  editConfigFile(
    (config) => {
      if (config.models?.some((m: any) => stringify(m) === stringify(model))) {
        return config;
      }
      if (config.models?.some((m: any) => m?.title === model.title)) {
        model.title = `${model.title} (1)`;
      }

      config.models.push(model);

      // Set the role for the model
      if (role) {
        if (!config.experimental) {
          config.experimental = {};
        }
        if (!config.experimental.modelRoles) {
          config.experimental.modelRoles = {};
        }
        config.experimental.modelRoles[role] = model.title;
      }

      return config;
    },
    (config) => {
      if (config.models?.some((m: any) => m?.title === model.title)) {
        model.title = `${model.title} (1)`;
      }

      if (!config.models) {
        config.models = [];
      }

      config.models.push({
        name: model.title,
        provider: model.provider,
        model: model.model,
        apiKey: model.apiKey,
        apiBase: model.apiBase,
        defaultCompletionOptions: model.completionOptions,
      });
      return config;
    },
  );
}

export function deleteModel(title: string) {
  editConfigFile(
    (config) => {
      config.models = config.models.filter((m: any) => m.title !== title);
      return config;
    },
    (config) => {
      config.models = config.models?.filter((m: any) => m.name !== title);
      return config;
    },
  );
}

export function getModelByRole<T extends keyof ExperimentalModelRoles>(
  config: ContinueConfig,
  role: T,
): ILLM | undefined {
  const roleTitle = config.experimental?.modelRoles?.[role];

  if (!roleTitle) {
    return undefined;
  }

  const matchingModel = config.models.find(
    (model) => model.title === roleTitle,
  );

  return matchingModel;
}

/**
 * This check is to determine if the user is on an unsupported CPU
 * target for our Lance DB binaries.
 *
 * See here for details: https://github.com/continuedev/continue/issues/940
 */
export function isSupportedLanceDbCpuTargetForLinux(ide?: IDE) {
  const CPU_FEATURES_TO_CHECK = ["avx2", "fma"] as const;

  const globalContext = new GlobalContext();
  const globalContextVal = globalContext.get(
    "isSupportedLanceDbCpuTargetForLinux",
  );

  // If we've already checked the CPU target, return the cached value
  if (globalContextVal !== undefined) {
    return globalContextVal;
  }

  const arch = os.arch();

  // This check only applies to x64
  //https://github.com/lancedb/lance/issues/2195#issuecomment-2057841311
  if (arch !== "x64") {
    globalContext.update("isSupportedLanceDbCpuTargetForLinux", true);
    return true;
  }

  try {
    const cpuFlags = fs.readFileSync("/proc/cpuinfo", "utf-8").toLowerCase();

    const isSupportedLanceDbCpuTargetForLinux = cpuFlags
      ? CPU_FEATURES_TO_CHECK.every((feature) => cpuFlags.includes(feature))
      : true;

    // If it's not a supported CPU target, and it's the first time we are checking,
    // show a toast to inform the user that we are going to disable indexing.
    if (!isSupportedLanceDbCpuTargetForLinux && ide) {
      // We offload our async toast to `showUnsupportedCpuToast` to prevent making
      // our config loading async upstream of `isSupportedLanceDbCpuTargetForLinux`
      void showUnsupportedCpuToast(ide);
    }

    globalContext.update(
      "isSupportedLanceDbCpuTargetForLinux",
      isSupportedLanceDbCpuTargetForLinux,
    );

    return isSupportedLanceDbCpuTargetForLinux;
  } catch (error) {
    // If we can't determine CPU features, default to true
    return true;
  }
}

async function showUnsupportedCpuToast(ide: IDE) {
  const shouldOpenLink = await ide.showToast(
    "warning",
    "Codebase indexing disabled - Your Linux system lacks required CPU features (AVX2, FMA)",
    "Learn more",
  );

  if (shouldOpenLink) {
    void ide.openUrl(
      "https://docs.continue.dev/troubleshooting#i-received-a-codebase-indexing-disabled---your-linux-system-lacks-required-cpu-features-avx2-fma-notification",
    );
  }
}
