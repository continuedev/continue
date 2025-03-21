import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ProfileDescription } from "core/config/ConfigHandler";
import { OrganizationDescription } from "core/config/ProfileLifecycleManager";

interface PreferencesState {
  bookmarksByName: string[];
}

interface ProfilesState {
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
    },
    setAvailableProfiles: (
      state,
      { payload }: PayloadAction<ProfileDescription[] | null>,
    ) => {
      state.availableProfiles = payload;
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

      // Initialize preferences for this profile if needed
      if (!state.preferencesByProfileId[profileId]) {
        state.preferencesByProfileId[profileId] = {
          bookmarksByName: [],
        };
      }

      // Only add if not already bookmarked
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

      if (!profileId || !state.preferencesByProfileId[profileId]) return;

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
