import { createAsyncThunk } from "@reduxjs/toolkit";
import { OrganizationDescription } from "core/config/ProfileLifecycleManager";
import { ThunkApiType } from "../../store";
import { setAvailableProfiles } from "../profiles/slice";
import { setOrganizations, setSelectedOrganizationId } from "./slice";

export const selectOrgThunk = createAsyncThunk<
  void,
  string | null,
  ThunkApiType
>("organizations/select", async (id, { dispatch, extra, getState }) => {
  const state = getState();
  const initialId = state.organizations.selectedOrganizationId;
  let newId = id;

  // If no orgs, force clear
  if (state.organizations.organizations.length === 0) {
    newId = null;
  } else if (newId) {
    // If new id doesn't match an existing org, clear it
    if (!state.organizations.organizations.find((o) => o.id === newId)) {
      newId = null;
    }
  }
  // Unlike profiles, don't fallback to the first org,
  // Fallback to Personal (org = null)

  if (initialId !== newId) {
    dispatch(setAvailableProfiles(null));
    dispatch(setSelectedOrganizationId(newId));
    extra.ideMessenger.post("didChangeSelectedOrg", {
      id: newId,
    });
  }
});

export const updateOrgsThunk = createAsyncThunk<
  void,
  OrganizationDescription[],
  ThunkApiType
>("organizations/update", async (orgs, { dispatch, getState }) => {
  const state = getState();
  dispatch(setOrganizations(orgs));

  // This will trigger reselection if needed
  dispatch(selectOrgThunk(state.organizations.selectedOrganizationId));
});
