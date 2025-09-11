import fs from "fs";
import os from "os";

import { ModelConfig } from "@continuedev/config-yaml";
import {
  ContinueConfig,
  ExperimentalModelRoles,
  IDE,
  ILLM,
  JSONModelDescription,
  PromptTemplate,
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
  model: JSONModelDescription,
  role?: keyof ExperimentalModelRoles,
) {
  editConfigFile(
    (config) => {
      if (config.models?.some((m) => stringify(m) === stringify(model))) {
        return config;
      }

      const numMatches = config.models?.reduce(
        (prev, curr) => (curr.title.startsWith(model.title) ? prev + 1 : prev),
        0,
      );
      if (numMatches !== undefined && numMatches > 0) {
        model.title = `${model.title} (${numMatches})`;
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
      const numMatches = config.models?.reduce(
        (prev, curr) =>
          "name" in curr && curr.name.startsWith(model.title) ? prev + 1 : prev,
        0,
      );
      if (numMatches !== undefined && numMatches > 0) {
        model.title = `${model.title} (${numMatches})`;
      }

      if (!config.models) {
        config.models = [];
      }

      const desc: ModelConfig = {
        name: model.title,
        provider: model.provider,
        model: model.model,
        apiKey: model.apiKey,
        apiBase: model.apiBase,
        maxStopWords: model.maxStopWords,
        defaultCompletionOptions: model.completionOptions,
      };
      config.models.push(desc);
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

  const matchingModel = config.modelsByRole.chat.find(
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

/**
 * This is required because users are only able to define prompt templates as a
 * string, while internally we also allow prompt templates to be functions
 * @param templates
 * @returns
 */
export function serializePromptTemplates(
  templates: Record<string, PromptTemplate> | undefined,
): Record<string, string> | undefined {
  if (!templates) return undefined;

  return Object.fromEntries(
    Object.entries(templates).map(([key, template]) => {
      const serialized = typeof template === "function" ? "" : template;
      return [key, serialized];
    }),
  );
}
