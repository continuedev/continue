import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { SlashCommandDescription } from "core";
import { ProfileDescription } from "core/config/ConfigHandler";

const DEFAULT_SLASH_COMMANDS_BOOKMARKS_COUNT = 5;

const INITIAL_PREFERENCES_STATE: PreferencesState = {
  bookmarkedSlashCommands: [],
};

export interface PreferencesState {
  bookmarkedSlashCommands: string[];
}

export interface ProfilesState {
  availableProfiles: ProfileDescription[] | null;
  selectedProfileId: string | null;
  preferencesByProfileId: Record<string, PreferencesState>;
}

const initialState: ProfilesState = {
  availableProfiles: null,
  selectedProfileId: null,
  preferencesByProfileId: {},
};

export const profilesSlice = createSlice({
  name: "profiles",
  initialState,
  reducers: {
    setSelectedProfile: (state, { payload }: PayloadAction<string | null>) => {
      state.selectedProfileId = payload;
    },
    setAvailableProfiles: (
      state,
      { payload }: PayloadAction<ProfileDescription[] | null>,
    ) => {
      state.availableProfiles = payload;
    },
    initializeProfilePreferences: (
      state,
      action: PayloadAction<{
        profileId: string;
        defaultSlashCommands?: SlashCommandDescription[];
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
        state.availableProfiles?.find(
          (profile) => profile.id === state.selectedProfileId,
        ) ?? null
      );
    },

    selectSelectedProfileId: (state) => state.selectedProfileId,

    selectBookmarkedSlashCommands: (state) => {
      if (!state.selectedProfileId) return [];
      const preferences = state.preferencesByProfileId[state.selectedProfileId];
      return preferences?.bookmarkedSlashCommands || [];
    },

    selectPreferencesByProfileId: (state) => state.preferencesByProfileId,
  },
});

export const {
  setAvailableProfiles,
  setSelectedProfile,
  bookmarkSlashCommand,
  unbookmarkSlashCommand,
  initializeProfilePreferences,
} = profilesSlice.actions;

export const {
  selectSelectedProfile,
  selectSelectedProfileId,
  selectBookmarkedSlashCommands,
  selectPreferencesByProfileId,
} = profilesSlice.selectors;

export const { reducer: profilesReducer } = profilesSlice;
