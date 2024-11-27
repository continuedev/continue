import { createSelector } from "@reduxjs/toolkit";
import { ComboBoxItemType } from "../../components/mainInput/types";
import { RootState } from "../store";

export const selectSlashCommandComboBoxInputs = createSelector(
  [(store: RootState) => store.state.config.slashCommands],
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
  [(store: RootState) => store.state.config.slashCommands],
  (slashCommands) => {
    return slashCommands || [];
  },
);

export const selectContextProviderDescriptions = createSelector(
  [(store: RootState) => store.state.config.contextProviders],
  (providers) => {
    return providers?.filter((desc) => desc.type === "submenu") || [];
  },
);

export const selectDefaultContextProviders = createSelector(
  [(store: RootState) => store.state.config.experimental?.defaultContext],
  (defaultProviders) => {
    return defaultProviders ?? [];
  },
);

export const selectUseActiveFile = createSelector(
  [(store: RootState) => store.state.config.experimental?.defaultContext],
  (defaultContext) => defaultContext?.includes("activeFile" as any),
);

export const selectApplyState = createSelector(
  [(store: RootState) => store.state.applyStates],
  (applyStates) => {
    return (
      applyStates.find((state) => state.streamId === "edit")?.status ?? "closed"
    );
  },
);
