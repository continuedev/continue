import z from "zod";
import {
  BrowserSerializedContinueConfig,
  ContinueConfig,
  Config,
  SerializedContinueConfig,
} from "..";

export const sharedConfigSchema = z
  .object({
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

export function modifyContinueConfigWithSharedConfig<
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

// continueConfig.tabAutocompleteOptions = {
//   ...continueConfig.tabAutocompleteOptions,
//   useCache: sharedConfig.useAutocompleteCache,
//   disableInFiles: sharedConfig.disableAutocompleteInFiles,
//   multilineCompletions: sharedConfig.useAutocompleteMultilineCompletions,
// };
// continueConfig.ui = {
//   ...continueConfig.ui,
//   codeBlockToolbarPosition: sharedConfig.codeBlockToolbarPosition,
//   fontSize: sharedConfig.fontSize,
//   codeWrap: sharedConfig.codeWrap,
//   displayRawMarkdown: sharedConfig.displayRawMarkdown,
//   showChatScrollbar: sharedConfig.showChatScrollbar,
// };
//   continueConfig.allowAnonymousTelemetry = sharedConfig.allowAnonymousTelemetry;
//   continueConfig.disableIndexing = sharedConfig.disableIndexing;
// continueConfig.disableIndexing = sharedConfig.disableIndexing;
// continueConfig.disableSessionTitles = sharedConfig.disableSessionTitles;
// continueConfig.experimental = {
//   ...continueConfig.experimental,
//   useChromiumForDocsCrawling: sharedConfig.useChromiumForDocsCrawling,
//   readResponseTTS: sharedConfig.readResponseTTS,
//   promptPath: sharedConfig.promptPath,
// };
