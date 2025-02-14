import { ConfigResult, ConfigValidationError } from "@continuedev/config-yaml";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { BrowserSerializedContinueConfig } from "core";
import {
  OrganizationDescription,
  ProfileDescription,
} from "core/config/ProfileLifecycleManager";
import { DEFAULT_MAX_TOKENS } from "core/llm/constants";

export type ConfigState = {
  configError: ConfigValidationError[] | undefined;
  config: BrowserSerializedContinueConfig;
  defaultModelTitle: string;
  selectedProfileId: string | null;
  availableProfiles: ProfileDescription[];
  selectedOrganizationId: string | null;
  availableOrganizations: OrganizationDescription[];
};

const initialState: ConfigState = {
  configError: undefined,
  defaultModelTitle: "GPT-4",
  config: {
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
    usePlatform: false,
  },
  selectedProfileId: "local",
  availableProfiles: [
    {
      id: "local",
      title: "Local",
      errors: undefined,
      profileType: "local",
      fullSlug: {
        ownerSlug: "",
        packageSlug: "",
        versionSlug: "",
      },
      iconUrl: "",
    },
  ],
  selectedOrganizationId: "",
  availableOrganizations: [],
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

      if (!config) {
        return;
      }

      const defaultModelTitle =
        config.models.find((model) => model.title === state.defaultModelTitle)
          ?.title ||
        config.models[0]?.title ||
        "";
      state.config = config;
      state.defaultModelTitle = defaultModelTitle;
    },
    updateConfig: (
      state,
      { payload: config }: PayloadAction<BrowserSerializedContinueConfig>,
    ) => {
      state.config = config;
    },
    setConfigError: (
      state,
      { payload: error }: PayloadAction<ConfigValidationError[] | undefined>,
    ) => {
      state.configError = error;
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
    setSelectedProfileId: (
      state,
      { payload }: PayloadAction<string | null>,
    ) => {
      state.selectedProfileId = payload;
    },
    setAvailableProfiles: (
      state,
      { payload }: PayloadAction<ProfileDescription[]>,
    ) => {
      state.availableProfiles = payload;

      // If no orgs or current profile id isn't found, clear it
      if (payload.length === 0) {
        state.selectedProfileId = null;
      } else if (
        state.selectedProfileId &&
        !state.availableProfiles.find(
          (profile) => profile.id === state.selectedProfileId,
        )
      ) {
        state.selectedProfileId = state.availableProfiles[0].id; // Note "local" won't exist if using hub
      }
    },
    setSelectedOrganizationId: (
      state,
      { payload }: PayloadAction<string | null>,
    ) => {
      state.selectedOrganizationId = payload;
    },
    setAvailableOrganizations: (
      state,
      { payload }: PayloadAction<OrganizationDescription[]>,
    ) => {
      state.availableOrganizations = payload;
      // If no orgs or current org id isn't found, clear it
      if (payload.length === 0) {
        state.selectedOrganizationId = null;
      } else if (
        state.selectedOrganizationId &&
        !state.availableOrganizations.find(
          (org) => org.id === state.selectedOrganizationId,
        )
      ) {
        state.selectedOrganizationId = state.availableOrganizations[0].id; // could set to null to default to personal
      }
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
  setConfigError,
  setSelectedProfileId,
  setSelectedOrganizationId,
  setAvailableProfiles,
  setAvailableOrganizations,
} = configSlice.actions;

export const {
  selectDefaultModel,
  selectDefaultModelContextLength,
  selectUIConfig,
} = configSlice.selectors;

export default configSlice.reducer;
