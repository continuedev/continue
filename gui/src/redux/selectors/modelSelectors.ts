import { RootState } from "../store";
import { createSelector } from "@reduxjs/toolkit";

export const defaultModelSelector = createSelector(
  [
    (store: RootState) => store.state.defaultModelTitle,
    (store: RootState) => store.state.config.models,
  ],
  (defaultModelTitle, models) => {
    return models?.find((model) => model.title === defaultModelTitle);
  },
);
