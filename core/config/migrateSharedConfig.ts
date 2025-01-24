import * as fs from "fs";

import * as JSONC from "comment-json";

import { IDE, SerializedContinueConfig } from "..";
import { SharedConfigSchema } from "./sharedConfig";
import { GlobalContext } from "../util/GlobalContext";
import { editConfigJson } from "../util/paths";
import { resolveSerializedConfig } from "./load";

/*
  This migration function eliminates deprecated values from the json file
  And writes them to the shared config
*/
export function migrateJsonSharedConfig(filepath: string, ide: IDE): void {
  try {
    let config = resolveSerializedConfig(filepath);
    const shareConfigUpdates: SharedConfigSchema = {};

    let effected = false;

    const { allowAnonymousTelemetry, ...withoutAllowTelemetry } = config;
    if (allowAnonymousTelemetry !== undefined) {
      shareConfigUpdates.allowAnonymousTelemetry = allowAnonymousTelemetry;
      config = withoutAllowTelemetry;
      effected = true;
    }

    const { disableIndexing, ...withoutDisableIndexing } = config;
    if (disableIndexing !== undefined) {
      shareConfigUpdates.disableIndexing = disableIndexing;
      config = withoutDisableIndexing;
      effected = true;
    }

    const { disableSessionTitles, ...withoutDisableSessionTitles } = config;
    if (config.disableSessionTitles !== undefined) {
      shareConfigUpdates.disableSessionTitles = config.disableSessionTitles;
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
        shareConfigUpdates.disableAutocompleteInFiles = disableInFiles;
        migratedAutocomplete = withoutDisableInFiles;
        effected = true;
      }

      config = {
        ...withoutAutocompleteOptions,
        tabAutocompleteOptions: migratedAutocomplete,
      };
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

      config = {
        ...withoutExperimental,
        experimental: migratedExperimental,
      };
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

      const { showChatScrollbar, ...withoutShowChatScrollbar } = migratedUI;
      if (showChatScrollbar !== undefined) {
        shareConfigUpdates.showChatScrollbar = showChatScrollbar;
        migratedUI = withoutShowChatScrollbar;
        effected = true;
      }

      config = {
        ...withoutUI,
        ui: migratedUI,
      };
    }

    if (effected) {
      new GlobalContext().updateSharedConfig(shareConfigUpdates);
      void ide.showToast(
        "warning",
        "Migrated deprecated Continue JSON settings. Edit in the Config Page",
      );
      editConfigJson(() => config);
    }
  } catch (e) {
    throw new Error(`Migration: Failed to parse config.json: ${e}`);
  }
}
