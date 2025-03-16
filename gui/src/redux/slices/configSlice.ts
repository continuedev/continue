import { ConfigResult, ConfigValidationError } from "@continuedev/config-yaml";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { BrowserSerializedContinueConfig } from "core";
import { DEFAULT_MAX_TOKENS } from "core/llm/constants";

export type ConfigState = {
  configError: ConfigValidationError[] | undefined;
  config: BrowserSerializedContinueConfig;
  defaultModelTitle?: string;
};

const EMPTY_CONFIG: BrowserSerializedContinueConfig = {
  slashCommands: [
    {
      name: "share",
      description: "Export the current chat session to markdown",
    },
    {
      name: "cmd",
      description: "Generate a shell command",
    },
  ],
  contextProviders: [],
  models: [],
  tools: [],
  usePlatform: true,
  modelsByRole: {
    chat: [],
    apply: [],
    edit: [],
    summarize: [],
    autocomplete: [],
    rerank: [],
    embed: [],
  },
  selectedModelByRole: {
    chat: null,
    apply: null,
    edit: null,
    summarize: null,
    autocomplete: null,
    rerank: null,
    embed: null,
  },
};

const initialState: ConfigState = {
  configError: undefined,
  defaultModelTitle: undefined,
  config: EMPTY_CONFIG,
};

export const configSlice = createSlice({
  name: "config",
  initialState,
  reducers: {
    setConfigResult: (
      state,
      {
        payload: result,
      }: PayloadAction<ConfigResult<BrowserSerializedContinueConfig>>,
    ) => {
      const { config, errors } = result;
      state.configError = errors;

      // If an error is found in config on save,
      // We must invalidate the GUI config too,
      // Since core won't be able to load config
      // Don't invalidate the loaded config
      if (!config) {
        state.config = EMPTY_CONFIG;
        state.defaultModelTitle = undefined;
      } else {
        state.config = config;
        state.defaultModelTitle =
          config.models.find((model) => model.title === state.defaultModelTitle)
            ?.title || config.models[0]?.title;
      }
    },
    updateConfig: (
      state,
      { payload: config }: PayloadAction<BrowserSerializedContinueConfig>,
    ) => {
      state.config = config;
    },
    setDefaultModel: (
      state,
      { payload }: PayloadAction<{ title: string; force?: boolean }>,
    ) => {
      const model = state.config.models.find(
        (model) => model.title === payload.title,
      );
      if (!model && !payload.force) return;
      return {
        ...state,
        defaultModelTitle: payload.title,
      };
    },
    cycleDefaultModel: (state, { payload }: PayloadAction<"next" | "prev">) => {
      const currentIndex = state.config.models.findIndex(
        (model) => model.title === state.defaultModelTitle,
      );
      const nextIndex =
        (currentIndex +
          (payload === "next" ? 1 : -1) +
          state.config.models.length) %
        state.config.models.length;
      return {
        ...state,
        defaultModelTitle: state.config.models[nextIndex].title,
      };
    },
  },
  selectors: {
    selectDefaultModel: (state) => {
      return state.config.models.find(
        (model) => model.title === state.defaultModelTitle,
      );
    },
    selectDefaultModelContextLength: (state): number => {
      return (
        configSlice.getSelectors().selectDefaultModel(state)?.contextLength ||
        DEFAULT_MAX_TOKENS
      );
    },
    selectUIConfig: (state) => {
      return state.config?.ui ?? null;
    },
  },
});

export const {
  setDefaultModel,
  cycleDefaultModel,
  updateConfig,
  setConfigResult,
} = configSlice.actions;

export const {
  selectDefaultModel,
  selectDefaultModelContextLength,
  selectUIConfig,
} = configSlice.selectors;

export default configSlice.reducer;
