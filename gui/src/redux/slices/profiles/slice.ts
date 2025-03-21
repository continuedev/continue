import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ProfileDescription } from "core/config/ConfigHandler";
import { OrganizationDescription } from "core/config/ProfileLifecycleManager";

interface ProfilesState {
  availableProfiles: ProfileDescription[] | null;
  selectedProfileId: string | null;
  organizations: OrganizationDescription[];
  selectedOrganizationId: string | null;
}

const initialState: ProfilesState = {
  availableProfiles: null,
  selectedProfileId: null,
  organizations: [],
  selectedOrganizationId: null,
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
  },
  selectors: {
    selectSelectedProfile: (state) => {
      return (
        state.availableProfiles?.find(
          (profile) => profile.id === state.selectedProfileId,
        ) ?? null
      );
    },
  },
});

export const {
  setAvailableProfiles,
  setSelectedProfile,
  setOrganizations,
  setSelectedOrganizationId,
} = profilesSlice.actions;

export const { selectSelectedProfile } = profilesSlice.selectors;

export const { reducer: profilesReducer } = profilesSlice;
