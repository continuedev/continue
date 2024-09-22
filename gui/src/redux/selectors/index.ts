import { createSelector } from "@reduxjs/toolkit";
import { ComboBoxItemType } from "../../components/mainInput/types";
import { RootState } from "../store";

export const selectSlashCommands = createSelector(
  [(store: RootState) => store.state.config.slashCommands],
  (slashCommands) => {
    return (
      slashCommands?.map((cmd) => {
        return {
          title: `/${cmd.name.charAt(0).toUpperCase() + cmd.name.slice(1)}`,
          description: cmd.description,
          type: "slashCommand" as ComboBoxItemType,
        };
      }) || []
    );
  },
);

export const selectContextProviderDescriptions = createSelector(
  [(store: RootState) => store.state.config.contextProviders],
  (providers) => {
    return providers?.filter((desc) => desc.type === "submenu") || [];
  },
);

export const selectUseActiveFile = createSelector(
  [(store: RootState) => store.state.config.experimental?.defaultContext],
  (defaultContext) => defaultContext?.includes("activeFile" as any),
);
