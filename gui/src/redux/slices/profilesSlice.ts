import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { SlashCommandDescWithSource } from "core";
import { SerializedOrgWithProfiles } from "core/config/ProfileLifecycleManager";

const DEFAULT_SLASH_COMMANDS_BOOKMARKS_COUNT = 5;

const INITIAL_PREFERENCES_STATE: PreferencesState = {
  bookmarkedSlashCommands: [],
};

export interface PreferencesState {
  bookmarkedSlashCommands: string[];
}

export interface ProfilesState {
  organizations: SerializedOrgWithProfiles[];
  selectedProfileId: string | null;
  selectedOrganizationId: string | null;
  preferencesByProfileId: Record<string, PreferencesState>;
}

export const INITIAL_PROFILES_STATE: ProfilesState = {
  preferencesByProfileId: {},
  selectedProfileId: null,
  selectedOrganizationId: null,
  organizations: [
    {
      id: "personal",
      profiles: [
        {
          title: "Local Agent",
          id: "local",
          errors: [],
          profileType: "local",
          uri: "",
          iconUrl: "",
          fullSlug: {
            ownerSlug: "",
            packageSlug: "",
            versionSlug: "",
          },
        },
      ],
      slug: "",
      selectedProfileId: "local",
      name: "Personal",
      iconUrl: "",
    },
  ],
};

export const profilesSlice = createSlice({
  name: "profiles",
  initialState: INITIAL_PROFILES_STATE,
  reducers: {
    setSelectedProfile: (state, { payload }: PayloadAction<string | null>) => {
      state.selectedProfileId = payload;
      const currentOrg = state.organizations.find(
        (o) => o.id === state.selectedOrganizationId,
      );
      if (currentOrg) {
        currentOrg.selectedProfileId = payload;
      }
    },
    setOrganizations: (
      state,
      { payload }: PayloadAction<SerializedOrgWithProfiles[]>,
    ) => {
      state.organizations = payload;
    },
    setSelectedOrgId: (state, { payload }: PayloadAction<string | null>) => {
      state.selectedOrganizationId = payload;
      const org = state.organizations.find((o) => o.id === payload);
      if (org) {
        state.selectedProfileId = org.selectedProfileId;
      } else {
        state.selectedProfileId = null;
      }
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
      const selectedOrg = state.organizations.find(
        (org) => org.id === state.selectedOrganizationId,
      );
      if (selectedOrg) {
        const profile = selectedOrg.profiles.find(
          (profile) => profile.id === state.selectedProfileId,
        );
        return profile ?? null;
      } else {
        return null;
      }
    },

    selectCurrentOrg: (state) => {
      return (
        state.organizations.find(
          (org) => org.id === state.selectedOrganizationId,
        ) ?? null
      );
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
  setOrganizations,
  setSelectedOrgId,
} = profilesSlice.actions;

export const {
  selectSelectedProfile,
  selectBookmarkedSlashCommands,
  selectPreferencesByProfileId,
  selectCurrentOrg,
} = profilesSlice.selectors;

export const { reducer: profilesReducer } = profilesSlice;
