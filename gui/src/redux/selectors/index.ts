import { createSelector } from "@reduxjs/toolkit";
import {
  ComboBoxItem,
  ComboBoxItemType,
} from "../../components/mainInput/types";
import { RootState } from "../store";

export const selectSlashCommandComboBoxInputs = createSelector(
  [(state: RootState) => state.config.config.slashCommands],
  (slashCommands) => {
    return (
      slashCommands?.map((cmd) => {
        return {
          title: cmd.name,
          description: cmd.description,
          type: "slashCommand" as ComboBoxItemType,
          content: cmd.prompt,
        } as ComboBoxItem;
      }) || []
    );
  },
);

export const selectSlashCommands = createSelector(
  [(state: RootState) => state.config.config.slashCommands],
  (slashCommands) => {
    return slashCommands || [];
  },
);

export const selectSubmenuContextProviders = createSelector(
  [(state: RootState) => state.config.config.contextProviders],
  (providers) => {
    return providers?.filter((desc) => desc.type === "submenu") || [];
  },
);

export const selectDefaultContextProviders = createSelector(
  [(state: RootState) => state.config.config.experimental?.defaultContext],
  (defaultProviders) => {
    return defaultProviders ?? [];
  },
);

export const selectUseActiveFile = createSelector(
  [(state: RootState) => state.config.config.experimental?.defaultContext],
  (defaultContext) => defaultContext?.includes("activeFile" as any),
);

export const selectUseHub = createSelector(
  [(state: RootState) => state.config.config.usePlatform],
  (usePlatform) => usePlatform,
);
