import { ConfigResult, ConfigValidationError } from "@continuedev/config-yaml";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { BrowserSerializedContinueConfig } from "core";
import { DEFAULT_MAX_TOKENS } from "core/llm/constants";

export type ConfigState = {
  configError: ConfigValidationError[] | undefined;
  config: BrowserSerializedContinueConfig;
  loading: boolean;
};

export const EMPTY_CONFIG: BrowserSerializedContinueConfig = {
  slashCommands: [],
  contextProviders: [],
  tools: [],
  mcpServerStatuses: [],
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
  rules: [],
};

/**
 * Sanitizes MCP server statuses to ensure they have valid properties
 * and prevent rendering issues from corrupted/incomplete data.
 */
function sanitizeMcpServerStatuses(
  statuses: any[],
): BrowserSerializedContinueConfig["mcpServerStatuses"] {
  if (!Array.isArray(statuses)) {
    return [];
  }

  return statuses.filter((server) => {
    // Filter out invalid servers that could cause render loops
    return (
      server &&
      typeof server === "object" &&
      typeof server.id === "string" &&
      server.id.length > 0 &&
      typeof server.name === "string" &&
      server.name.length > 0 &&
      // Ensure arrays exist even if empty
      Array.isArray(server.prompts) &&
      Array.isArray(server.resources) &&
      Array.isArray(server.resourceTemplates) &&
      Array.isArray(server.errors) &&
      Array.isArray(server.infos)
    );
  });
}

export const INITIAL_CONFIG_SLICE: ConfigState = {
  configError: undefined,
  config: EMPTY_CONFIG,
  loading: false,
};

export const configSlice = createSlice({
  name: "config",
  initialState: INITIAL_CONFIG_SLICE,
  reducers: {
    setConfigResult: (
      state,
      {
        payload: result,
      }: PayloadAction<ConfigResult<BrowserSerializedContinueConfig>>,
    ) => {
      const { config, errors } = result;
      if (!errors || errors.length === 0) {
        state.configError = undefined;
      } else {
        state.configError = errors;
      }

      // If an error is found in config on save,
      // We must invalidate the GUI config too,
      // Since core won't be able to load config
      // Don't invalidate the loaded config
      if (!config) {
        state.config = EMPTY_CONFIG;
      } else {
        // Sanitize MCP server statuses to prevent render issues
        state.config = {
          ...config,
          mcpServerStatuses: sanitizeMcpServerStatuses(
            config.mcpServerStatuses,
          ),
        };
      }
      state.loading = false;
    },
    updateConfig: (
      state,
      { payload: config }: PayloadAction<BrowserSerializedContinueConfig>,
    ) => {
      // Sanitize MCP server statuses when updating config
      state.config = {
        ...config,
        mcpServerStatuses: sanitizeMcpServerStatuses(config.mcpServerStatuses),
      };
    },
    setConfigLoading: (state, { payload: loading }: PayloadAction<boolean>) => {
      state.loading = loading;
    },
  },
  selectors: {
    selectSelectedChatModelContextLength: (state): number => {
      return (
        state.config.selectedModelByRole.chat?.contextLength ||
        DEFAULT_MAX_TOKENS
      );
    },
    selectSelectedChatModel: (state) => {
      return state.config.selectedModelByRole.chat;
    },
    selectUIConfig: (state) => {
      return state.config?.ui ?? null;
    },
  },
});

export const { updateConfig, setConfigResult, setConfigLoading } =
  configSlice.actions;

export const {
  selectSelectedChatModelContextLength,
  selectUIConfig,
  selectSelectedChatModel,
} = configSlice.selectors;

export default configSlice.reducer;
