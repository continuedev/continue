import { RootStore } from "../store";

export const contextLengthSelector = (state: RootStore) => {
  return (
    {
      "gpt-4": 8096,
      "gpt-3.5-turbo": 4096,
      "gpt-3.5-turbo-16k": 16384,
      "gpt-4-32k": 32768,
      "claude-2": 16384,
    }[state.serverState.config.model_roles?.default] || 4096
  );
};

export const defaultModelSelector = (state: RootStore) => {
  const title = state.serverState.config.model_roles?.default;
  if (!Array.isArray(state.serverState.config.models)) return;
  return state.serverState.config.models?.find(
    (model) => model.title === title
  );
};
