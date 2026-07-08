import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { SlashCommandDescWithSource } from "core";
import { ProfileDescription } from "core/config/ProfileLifecycleManager";

const DEFAULT_SLASH_COMMANDS_BOOKMARKS_COUNT = 5;

const INITIAL_PREFERENCES_STATE: PreferencesState = {
  bookmarkedSlashCommands: [],
};

export interface PreferencesState {
  bookmarkedSlashCommands: string[];
}

export interface ProfilesState {
  profiles: ProfileDescription[];
  selectedProfileId: string | null;
  preferencesByProfileId: Record<string, PreferencesState>;
}

export const INITIAL_PROFILES_STATE: ProfilesState = {
  preferencesByProfileId: {},
  selectedProfileId: null,
  profiles: [
    {
      title: "Main Config",
      id: "local",
      errors: [],
      uri: "",
      iconUrl: "",
      fullSlug: {
        ownerSlug: "",
        packageSlug: "",
        versionSlug: "",
      },
    },
  ],
};

export const profilesSlice = createSlice({
  name: "profiles",
  initialState: INITIAL_PROFILES_STATE,
  reducers: {
    setSelectedProfile: (state, { payload }: PayloadAction<string | null>) => {
      state.selectedProfileId = payload;
    },
    setProfiles: (state, { payload }: PayloadAction<ProfileDescription[]>) => {
      state.profiles = payload;
    },
    initializeProfilePreferences: (
      state,
      action: PayloadAction<{
        profileId: string;
        defaultSlashCommands?: SlashCommandDescWithSource[];
      }>,
    ) => {
      const { profileId, defaultSlashCommands = [] } = action.payload;
      const defaultSlashCommandNames = defaultSlashCommands.map(
        (cmd) => cmd.name,
      );

      // First ensure all profile preferences are complete to handle
      // the case where a new preference has been added since last load
      Object.keys(state.preferencesByProfileId).forEach((pid) => {
        state.preferencesByProfileId[pid] = {
          ...INITIAL_PREFERENCES_STATE,
          ...state.preferencesByProfileId[pid],
        };
      });

      // Then initialize preferences for the new profile if needed
      if (!state.preferencesByProfileId[profileId]) {
        state.preferencesByProfileId[profileId] = {
          bookmarkedSlashCommands: defaultSlashCommandNames.slice(
            0,
            DEFAULT_SLASH_COMMANDS_BOOKMARKS_COUNT,
          ),
        };
      }
    },
    bookmarkSlashCommand: (
      state,
      action: PayloadAction<{ commandName: string }>,
    ) => {
      const { commandName } = action.payload;
      const preferences =
        state.preferencesByProfileId[state.selectedProfileId ?? ""];

      if (!preferences) return;

      if (!preferences.bookmarkedSlashCommands.includes(commandName)) {
        preferences.bookmarkedSlashCommands.push(commandName);
      }
    },
    unbookmarkSlashCommand: (
      state,
      action: PayloadAction<{ commandName: string }>,
    ) => {
      const { commandName } = action.payload;
      const profileId = state.selectedProfileId;

      if (!profileId) return;

      const preferences = state.preferencesByProfileId[profileId];
      if (!preferences) return;

      preferences.bookmarkedSlashCommands =
        preferences.bookmarkedSlashCommands.filter(
          (cmd) => cmd !== commandName,
        );
    },
  },
  selectors: {
    selectSelectedProfile: (state) => {
      return (
        (state.profiles ?? []).find(
          (profile) => profile.id === state.selectedProfileId,
        ) ?? null
      );
    },

    selectProfiles: (state) => {
      return state.profiles ?? [];
    },

    selectBookmarkedSlashCommands: (state) => {
      if (!state.selectedProfileId) return [];
      const preferences = state.preferencesByProfileId[state.selectedProfileId];
      return preferences?.bookmarkedSlashCommands || [];
    },

    selectPreferencesByProfileId: (state) => state.preferencesByProfileId,
  },
});

export const {
  setSelectedProfile,
  bookmarkSlashCommand,
  unbookmarkSlashCommand,
  initializeProfilePreferences,
  setProfiles,
} = profilesSlice.actions;

export const {
  selectSelectedProfile,
  selectProfiles,
  selectBookmarkedSlashCommands,
  selectPreferencesByProfileId,
} = profilesSlice.selectors;

export const { reducer: profilesReducer } = profilesSlice;
