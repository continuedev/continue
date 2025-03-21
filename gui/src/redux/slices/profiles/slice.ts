import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ProfileDescription } from "core/config/ConfigHandler";
import { OrganizationDescription } from "core/config/ProfileLifecycleManager";

interface ProfilesState {
  availableProfiles: ProfileDescription[] | null;
  selectedProfile: ProfileDescription | null;
  organizations: OrganizationDescription[];
  selectedOrganizationId: string | null;
}

const initialState: ProfilesState = {
  availableProfiles: null,
  selectedProfile: null,
  organizations: [],
  selectedOrganizationId: null,
};

export const profilesSlice = createSlice({
  name: "profiles",
  initialState,
  // Important: these reducers don't handle selected profile/organization fallback logic
  // That is done in thunks
  reducers: {
    setSelectedProfile: (
      state,
      { payload }: PayloadAction<ProfileDescription | null>,
    ) => {
      state.selectedProfile = payload;
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
  },
});

export const {
  setSelectedProfile,
  setAvailableProfiles,
  setOrganizations,
  setSelectedOrganizationId,
} = profilesSlice.actions;

export const profilesReducer = profilesSlice.reducer;
