import { RootStore } from "../store";

export const defaultModelSelector = (state: RootStore) => {
  const title = state.state.defaultModelTitle;
  return state.state.config.models.find((model) => model.title === title);
};

export const contextLengthSelector = (state: RootStore) => {
  return defaultModelSelector(state)?.contextLength || 4096;
};
