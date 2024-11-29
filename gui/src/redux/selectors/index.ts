import { createSelector } from "@reduxjs/toolkit";
import { ComboBoxItemType } from "../../components/mainInput/types";
import { RootState } from "../store";

export const selectSlashCommandComboBoxInputs = createSelector(
  [(state: RootState) => state.config.config.slashCommands],
  (slashCommands) => {
    return (
      slashCommands?.map((cmd) => {
        return {
          title: `/${cmd.name}`,
          description: cmd.description,
          type: "slashCommand" as ComboBoxItemType,
        };
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

export const selectContextProviderDescriptions = createSelector(
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
