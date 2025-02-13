import { execSync } from "child_process";
import os from "os";

import {
  ContextProviderWithParams,
  ContinueConfig,
  IDE,
  ILLM,
  ModelDescription,
  ExperimentalModelRoles,
} from "../";
import { GlobalContext } from "../util/GlobalContext";
import { editConfigJson } from "../util/paths";

function stringify(obj: any, indentation?: number): string {
  return JSON.stringify(
    obj,
    (key, value) => {
      return value === null ? undefined : value;
    },
    indentation,
  );
}

export function addContextProvider(provider: ContextProviderWithParams) {
  editConfigJson((config) => {
    if (!config.contextProviders) {
      config.contextProviders = [provider];
    } else {
      config.contextProviders.push(provider);
    }

    return config;
  });
}

export function addModel(
  model: ModelDescription,
  role?: keyof ExperimentalModelRoles,
) {
  editConfigJson((config) => {
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
  });
}

export function addOpenAIKey(key: string) {
  editConfigJson((config) => {
    config.models = config.models
      .filter(
        (model) =>
          model.provider !== "free-trial" || model.model.startsWith("gpt"),
      )
      .map((m: ModelDescription) => {
        if (m.provider === "free-trial") {
          m.apiKey = key;
          m.provider = "openai";
        }
        return m;
      });
    return config;
  });
}

export function deleteModel(title: string) {
  editConfigJson((config) => {
    config.models = config.models.filter((m: any) => m.title !== title);
    return config;
  });
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
export function isSupportedLanceDbCpuTarget(ide: IDE) {
  const CPU_FEATURES_TO_CHECK = ["avx2", "fma"] as const;

  const globalContext = new GlobalContext();
  const globalContextVal = globalContext.get("isSupportedLanceDbCpuTarget");

  // If we've already checked the CPU target, return the cached value
  if (globalContextVal !== undefined) {
    return globalContextVal;
  }

  const arch = os.arch();
  const platform = os.platform();

  // This check only applies to x64
  //https://github.com/lancedb/lance/issues/2195#issuecomment-2057841311
  if (arch !== "x64") {
    globalContext.update("isSupportedLanceDbCpuTarget", true);
    return true;
  }

  try {
    const cpuFlags = (() => {
      switch (platform) {
        case "darwin":
          return execSync("sysctl -n machdep.cpu.features")
            .toString()
            .toLowerCase();
        case "linux":
          return execSync("cat /proc/cpuinfo").toString().toLowerCase();
        case "win32":
          return execSync("wmic cpu get caption /format:list")
            .toString()
            .toLowerCase();
        default:
          return "";
      }
    })();

    const isSupportedLanceDbCpuTarget = cpuFlags
      ? CPU_FEATURES_TO_CHECK.every((feature) => cpuFlags.includes(feature))
      : true;

    // If it's not a supported CPU target, and it's the first time we are checking,
    // show a toast to inform the user that we are going to disable indexing.
    if (!isSupportedLanceDbCpuTarget) {
      // We offload our async toast to `showUnsupportedCpuToast` to prevent making
      // our config loading async upstream of `isSupportedLanceDbCpuTarget`
      void showUnsupportedCpuToast(ide);
    }

    globalContext.update(
      "isSupportedLanceDbCpuTarget",
      isSupportedLanceDbCpuTarget,
    );

    return isSupportedLanceDbCpuTarget;
  } catch (error) {
    // If we can't determine CPU features, default to true
    return true;
  }
}

async function showUnsupportedCpuToast(ide: IDE) {
  const shouldOpenLink = await ide.showToast(
    "warning",
    "Codebase indexing is disabled due to CPU incompatibility",
    "Learn more",
  );

  if (shouldOpenLink) {
    void ide.openUrl("https://github.com/continuedev/continue/pull/3551");
  }
}
