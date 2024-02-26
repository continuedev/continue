import { DEFAULT_MAX_TOKENS } from "core/llm/constants";
import { RootState } from "../store";

export const defaultModelSelector = (state: RootState) => {
  const title = state.state.defaultModelTitle;
  return state.state.config.models.find((model) => model.title === title);
};

export const contextLengthSelector = (state: RootState) => {
  return defaultModelSelector(state)?.contextLength || DEFAULT_MAX_TOKENS;
};
