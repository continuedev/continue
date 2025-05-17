/**
 * I'm disabling this rule for the entire file under the assumption
 * that this is a one-time migration script. I'm expecting this
 * code to be removed in the future.
 */
/* eslint-disable max-statements */

import { IDE } from "..";
import { deduplicateArray } from "../util";
import { GlobalContext } from "../util/GlobalContext";
import { resolveSerializedConfig } from "./load";
import { SharedConfigSchema } from "./sharedConfig";

/*
  This migration function eliminates deprecated values from the json file
  And writes them to the shared config
*/
export function migrateJsonSharedConfig(filepath: string, ide: IDE): void {
  const globalContext = new GlobalContext();
  const currentSharedConfig = globalContext.getSharedConfig(); // for merging security concerns

  try {
    let config = resolveSerializedConfig(filepath);
    const shareConfigUpdates: SharedConfigSchema = {};

    let effected = false;

    const { allowAnonymousTelemetry, ...withoutAllowTelemetry } = config;
    if (allowAnonymousTelemetry !== undefined) {
      if (currentSharedConfig.allowAnonymousTelemetry !== false) {
        // safe merge for security
        shareConfigUpdates.allowAnonymousTelemetry = allowAnonymousTelemetry;
      }
      config = withoutAllowTelemetry;
      effected = true;
    }

    const { disableIndexing, ...withoutDisableIndexing } = config;
    if (disableIndexing !== undefined) {
      if (currentSharedConfig.disableIndexing !== true) {
        // safe merge for security
        shareConfigUpdates.disableIndexing = disableIndexing;
      }
      config = withoutDisableIndexing;
      effected = true;
    }

    const { disableSessionTitles, ...withoutDisableSessionTitles } = config;
    if (config.disableSessionTitles !== undefined) {
      if (currentSharedConfig.disableSessionTitles !== true) {
        // safe merge for security
        shareConfigUpdates.disableSessionTitles = config.disableSessionTitles;
      }
      config = withoutDisableSessionTitles;
      effected = true;
    }

    const { tabAutocompleteOptions, ...withoutAutocompleteOptions } = config;
    if (tabAutocompleteOptions !== undefined) {
      let migratedAutocomplete = { ...tabAutocompleteOptions };

      const { useCache, ...withoutUseCache } = migratedAutocomplete;
      if (useCache !== undefined) {
        shareConfigUpdates.useAutocompleteCache = useCache;
        migratedAutocomplete = withoutUseCache;
        effected = true;
      }

      const { multilineCompletions, ...withoutMultiline } =
        migratedAutocomplete;
      if (multilineCompletions !== undefined) {
        shareConfigUpdates.useAutocompleteMultilineCompletions =
          multilineCompletions;
        migratedAutocomplete = withoutMultiline;
        effected = true;
      }

      const { disableInFiles, ...withoutDisableInFiles } = migratedAutocomplete;
      if (disableInFiles !== undefined) {
        if (currentSharedConfig.disableAutocompleteInFiles !== undefined) {
          // safe merge for security
          shareConfigUpdates.disableAutocompleteInFiles = deduplicateArray(
            [
              ...currentSharedConfig.disableAutocompleteInFiles,
              ...disableInFiles,
            ],
            (a, b) => a === b,
          );
        } else {
          shareConfigUpdates.disableAutocompleteInFiles = disableInFiles;
        }
        shareConfigUpdates.disableAutocompleteInFiles = disableInFiles;
        migratedAutocomplete = withoutDisableInFiles;
        effected = true;
      }

      if (Object.keys(migratedAutocomplete).length > 0) {
        config = {
          ...withoutAutocompleteOptions,
          tabAutocompleteOptions: migratedAutocomplete,
        };
      } else {
        config = withoutAutocompleteOptions;
      }
    }

    const { experimental, ...withoutExperimental } = config;
    if (experimental !== undefined) {
      let migratedExperimental = { ...experimental };

      const { useChromiumForDocsCrawling, ...rest10 } = migratedExperimental;
      if (useChromiumForDocsCrawling !== undefined) {
        shareConfigUpdates.useChromiumForDocsCrawling =
          useChromiumForDocsCrawling;
        migratedExperimental = rest10;
        effected = true;
      }

      const { promptPath, ...withoutPromptPath } = migratedExperimental;
      if (promptPath !== undefined) {
        shareConfigUpdates.promptPath = promptPath;
        migratedExperimental = withoutPromptPath;
        effected = true;
      }

      const { readResponseTTS, ...withoutReadTTS } = migratedExperimental;
      if (readResponseTTS !== undefined) {
        shareConfigUpdates.readResponseTTS = readResponseTTS;
        migratedExperimental = withoutReadTTS;
        effected = true;
      }

      if (Object.keys(migratedExperimental).length > 0) {
        config = {
          ...withoutExperimental,
          experimental: migratedExperimental,
        };
      } else {
        config = withoutExperimental;
      }
    }

    const { ui, ...withoutUI } = config;
    if (ui !== undefined) {
      let migratedUI = { ...ui };

      const { codeBlockToolbarPosition, ...withoutToolbarPosition } =
        migratedUI;
      if (codeBlockToolbarPosition !== undefined) {
        shareConfigUpdates.codeBlockToolbarPosition = codeBlockToolbarPosition;
        migratedUI = withoutToolbarPosition;
        effected = true;
      }

      const { fontSize, ...withoutFontSize } = migratedUI;
      if (fontSize !== undefined) {
        shareConfigUpdates.fontSize = fontSize;
        migratedUI = withoutFontSize;
        effected = true;
      }

      const { codeWrap, ...withoutCodeWrap } = migratedUI;
      if (codeWrap !== undefined) {
        shareConfigUpdates.codeWrap = codeWrap;
        migratedUI = withoutCodeWrap;
        effected = true;
      }

      const { displayRawMarkdown, ...withoutMD } = migratedUI;
      if (displayRawMarkdown !== undefined) {
        shareConfigUpdates.displayRawMarkdown = displayRawMarkdown;
        migratedUI = withoutMD;
        effected = true;
      }

      const { autoAcceptEditToolDiffs, ...withoutAutoApply } = migratedUI;
      if (autoAcceptEditToolDiffs !== undefined) {
        shareConfigUpdates.autoAcceptEditToolDiffs = autoAcceptEditToolDiffs;
        migratedUI = withoutAutoApply;
        effected = true;
      }

      const { showChatScrollbar, ...withoutShowChatScrollbar } = migratedUI;
      if (showChatScrollbar !== undefined) {
        shareConfigUpdates.showChatScrollbar = showChatScrollbar;
        migratedUI = withoutShowChatScrollbar;
        effected = true;
      }

      // Ancient param to overwrite disableSessionTitles
      if ("getChatTitles" in migratedUI) {
        const { getChatTitles, ...withoutChatTitles } = migratedUI;
        if (getChatTitles === false) {
          shareConfigUpdates.disableSessionTitles = true;
          migratedUI = withoutChatTitles;
          effected = true;
        }
      }

      if (Object.keys(migratedUI).length > 0) {
        config = {
          ...withoutUI,
          ui: migratedUI,
        };
      } else {
        config = withoutUI;
      }
    }

    if (effected) {
      new GlobalContext().updateSharedConfig(shareConfigUpdates);
    }
  } catch (e) {
    throw new Error(`Migration: Failed to parse config.json: ${e}`);
  }
}
