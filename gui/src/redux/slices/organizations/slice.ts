import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { OrganizationDescription } from "core/config/ProfileLifecycleManager";

export interface OrganizationsState {
  organizations: OrganizationDescription[];
  selectedOrganizationId: string | null;
}

const initialState: OrganizationsState = {
  organizations: [],
  selectedOrganizationId: null,
};

export const organizationsSlice = createSlice({
  name: "organizations",
  initialState,
  reducers: {
    setOrganizations: (
      state,
      { payload }: PayloadAction<OrganizationDescription[]>,
    ) => {
      state.organizations = payload;
    },
    setSelectedOrgId: (state, { payload }: PayloadAction<string | null>) => {
      state.selectedOrganizationId = payload;
    },
  },
  selectors: {
    selectSelectedOrganization: (state) =>
      state.organizations.find(
        (org) => org.id === state.selectedOrganizationId,
      ) ?? null,
  },
});

export const { setOrganizations } = organizationsSlice.actions;

export const { selectSelectedOrganization } = organizationsSlice.selectors;

export const { reducer: organizationsReducer } = organizationsSlice;
