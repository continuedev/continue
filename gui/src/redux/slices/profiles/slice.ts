import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ProfileDescription } from "core/config/ConfigHandler";
import { OrganizationDescription } from "core/config/ProfileLifecycleManager";
import { ensureProfilePreferences } from "./utils";

export interface PreferencesState {
  bookmarksByName: string[];
}

export interface ProfilesState {
  availableProfiles: ProfileDescription[] | null;
  selectedProfileId: string | null;
  organizations: OrganizationDescription[];
  selectedOrganizationId: string | null;
  preferencesByProfileId: Record<string, PreferencesState>;
}

const initialState: ProfilesState = {
  availableProfiles: null,
  selectedProfileId: null,
  organizations: [],
  selectedOrganizationId: null,
  preferencesByProfileId: {},
};

export const profilesSlice = createSlice({
  name: "profiles",
  initialState,
  reducers: {
    setSelectedProfile: (state, { payload }: PayloadAction<string | null>) => {
      state.selectedProfileId = payload;

      if (payload) {
        ensureProfilePreferences(state, payload);
      }
    },
    setAvailableProfiles: (
      state,
      { payload }: PayloadAction<ProfileDescription[] | null>,
    ) => {
      state.availableProfiles = payload;

      if (payload) {
        for (const profile of payload) {
          ensureProfilePreferences(state, profile.id);
        }
      }
    },
    setOrganizations: (
      state,
      { payload }: PayloadAction<OrganizationDescription[]>,
    ) => {
      state.organizations = payload;
    },
    setSelectedOrganizationId: (
      state,
      { payload }: PayloadAction<string | null>,
    ) => {
      state.selectedOrganizationId = payload;
    },
    bookmarkSlashCommand: (
      state,
      action: PayloadAction<{ commandName: string }>,
    ) => {
      const { commandName } = action.payload;
      const profileId = state.selectedProfileId;

      if (!profileId) return;

      const bookmarks = state.preferencesByProfileId[profileId].bookmarksByName;
      if (!bookmarks.includes(commandName)) {
        bookmarks.push(commandName);
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
      preferences.bookmarksByName = preferences.bookmarksByName.filter(
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
      return preferences?.bookmarksByName || [];
    },

    selectPreferencesByProfileId: (state) => state.preferencesByProfileId,
  },
});

export const {
  setAvailableProfiles,
  setSelectedProfile,
  setOrganizations,
  setSelectedOrganizationId,
  bookmarkSlashCommand,
  unbookmarkSlashCommand,
} = profilesSlice.actions;

export const {
  selectSelectedProfile,
  selectSelectedProfileId,
  selectBookmarkedSlashCommands,
  selectPreferencesByProfileId,
} = profilesSlice.selectors;

export const { reducer: profilesReducer } = profilesSlice;
