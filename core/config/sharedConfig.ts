import {
  ModelRole,
  modelRolesSchema,
} from "@continuedev/config-yaml/dist/schemas/models";
import z from "zod";

import {
  BrowserSerializedContinueConfig,
  ContinueConfig,
  Config,
  SerializedContinueConfig,
} from "..";

export const sharedConfigSchema = z
  .object({
    selectedModels: z.record(modelRolesSchema, z.string().nullable()),

    // boolean fields in config.json
    allowAnonymousTelemetry: z.boolean(),
    disableIndexing: z.boolean(),
    disableSessionTitles: z.boolean(),

    // `experimental` in `ContinueConfig`
    useChromiumForDocsCrawling: z.boolean(),
    readResponseTTS: z.boolean(),
    promptPath: z.string(),

    // `ui` in `ContinueConfig`
    codeBlockToolbarPosition: z.enum(["top", "bottom"]),
    fontSize: z.number(),
    codeWrap: z.boolean(),
    displayRawMarkdown: z.boolean(),
    showChatScrollbar: z.boolean(),

    // `tabAutocompleteOptions` in `ContinueConfig`
    useAutocompleteCache: z.boolean(),
    useAutocompleteMultilineCompletions: z.enum(["always", "never", "auto"]),
    disableAutocompleteInFiles: z.array(z.string()),
  })
  .partial();

export type SharedConfigSchema = z.infer<typeof sharedConfigSchema>;

// For security in case of damaged config file, try to salvage any security-related values
export function salvageSharedConfig(sharedConfig: object): SharedConfigSchema {
  const salvagedConfig: SharedConfigSchema = {};
  if ("allowAnonymousTelemetry" in sharedConfig) {
    const val = z.boolean().safeParse(sharedConfig.allowAnonymousTelemetry);
    if (val.success) {
      salvagedConfig.allowAnonymousTelemetry = val.data;
    }
  }
  if ("disableIndexing" in sharedConfig) {
    const val = z.boolean().safeParse(sharedConfig.disableIndexing);
    if (val.success) {
      salvagedConfig.disableIndexing = val.data;
    }
  }
  if ("disableSessionTitles" in sharedConfig) {
    const val = z.boolean().safeParse(sharedConfig.disableSessionTitles);
    if (val.success) {
      salvagedConfig.disableSessionTitles = val.data;
    }
  }
  if ("disableAutocompleteInFiles" in sharedConfig) {
    const val = sharedConfigSchema.shape.disableAutocompleteInFiles.safeParse(
      sharedConfig.disableAutocompleteInFiles,
    );
    if (val.success) {
      salvagedConfig.disableAutocompleteInFiles = val.data;
    }
  }
  return salvagedConfig;
}

// Apply shared config to all forms of config
// - SerializedContinueConfig (config.json)
// - Config ("intermediate") - passed to config.ts
// - ContinueConfig
// - BrowserSerializedContinueConfig (final converted to be passed to GUI)

// This modify function is split into two steps
// - modifyAnyConfigWithSharedConfig - includes boolean flags like allowAnonymousTelemetry which
//   must be added BEFORE config.ts and remote server config apply for JSON
//   for security reasons
// - modifyFinalConfigWithSharedConfig - exists because of selectedModelsByRole
//   Which don't exist on SerializedContinueConfig/Config types, so must be added after the fact
export function modifyAnyConfigWithSharedConfig<
  T extends
    | ContinueConfig
    | BrowserSerializedContinueConfig
    | Config
    | SerializedContinueConfig,
>(continueConfig: T, sharedConfig: SharedConfigSchema): T {
  const configCopy = { ...continueConfig };
  configCopy.tabAutocompleteOptions = {
    ...configCopy.tabAutocompleteOptions,
  };
  if (sharedConfig.useAutocompleteCache !== undefined) {
    configCopy.tabAutocompleteOptions.useCache =
      sharedConfig.useAutocompleteCache;
  }
  if (sharedConfig.useAutocompleteMultilineCompletions !== undefined) {
    configCopy.tabAutocompleteOptions.multilineCompletions =
      sharedConfig.useAutocompleteMultilineCompletions;
  }
  if (sharedConfig.disableAutocompleteInFiles !== undefined) {
    configCopy.tabAutocompleteOptions.disableInFiles =
      sharedConfig.disableAutocompleteInFiles;
  }

  configCopy.ui = {
    ...configCopy.ui,
  };

  if (sharedConfig.codeBlockToolbarPosition !== undefined) {
    configCopy.ui.codeBlockToolbarPosition =
      sharedConfig.codeBlockToolbarPosition;
  }
  if (sharedConfig.fontSize !== undefined) {
    configCopy.ui.fontSize = sharedConfig.fontSize;
  }
  if (sharedConfig.codeWrap !== undefined) {
    configCopy.ui.codeWrap = sharedConfig.codeWrap;
  }
  if (sharedConfig.displayRawMarkdown !== undefined) {
    configCopy.ui.displayRawMarkdown = sharedConfig.displayRawMarkdown;
  }
  if (sharedConfig.showChatScrollbar !== undefined) {
    configCopy.ui.showChatScrollbar = sharedConfig.showChatScrollbar;
  }

  if (sharedConfig.allowAnonymousTelemetry !== undefined) {
    configCopy.allowAnonymousTelemetry = sharedConfig.allowAnonymousTelemetry;
  }
  if (sharedConfig.disableIndexing !== undefined) {
    configCopy.disableIndexing = sharedConfig.disableIndexing;
  }
  if (sharedConfig.disableSessionTitles !== undefined) {
    configCopy.disableSessionTitles = sharedConfig.disableSessionTitles;
  }

  configCopy.experimental = {
    ...configCopy.experimental,
  };
  if (sharedConfig.promptPath !== undefined) {
    configCopy.experimental.promptPath = sharedConfig.promptPath;
  }
  if (sharedConfig.useChromiumForDocsCrawling !== undefined) {
    configCopy.experimental.useChromiumForDocsCrawling =
      sharedConfig.useChromiumForDocsCrawling;
  }
  if (sharedConfig.readResponseTTS !== undefined) {
    configCopy.experimental.readResponseTTS = sharedConfig.readResponseTTS;
  }

  return configCopy;
}

export function modifyFinalConfigWithSharedConfig<
  T extends ContinueConfig | BrowserSerializedContinueConfig,
>(continueConfig: T, sharedConfig: SharedConfigSchema): T {
  const configCopy = { ...continueConfig };
  const selectedModelsForProfile: Record<ModelRole, string | null> = {
    apply: null,
    autocomplete: null,
    chat: null,
    edit: null,
    embed: null,
    rerank: null,
    summarize: null,
  };
  // configCopy.selectedModelByRole = selectedModelsForProfile;
  return configCopy;
}
