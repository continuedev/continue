import { createAsyncThunk } from "@reduxjs/toolkit";
import { ProfileDescription } from "core/config/ConfigHandler";
import { OrganizationDescription } from "core/config/ProfileLifecycleManager";
import { ThunkApiType } from "../../store";
import {
  setAvailableProfiles,
  setOrganizations,
  setSelectedOrganizationId,
  setSelectedProfile,
} from "./slice";

export const selectProfileThunk = createAsyncThunk<
  void,
  string | null,
  ThunkApiType
>("profiles/select", async (id, { dispatch, extra, getState }) => {
  const state = getState();

  if (state.profiles.availableProfiles === null) {
    // Currently in loading state
    return;
  }

  const initialId = state.profiles.selectedProfileId;

  let newId = id;

  // If no profiles, force clear
  if (state.profiles.availableProfiles.length === 0) {
    newId = null;
  } else {
    // If new id doesn't match an existing profile, clear it
    if (newId) {
      if (!state.profiles.availableProfiles.find((p) => p.id === newId)) {
        newId = null;
      }
    }
    if (!newId) {
      // At this point if null ID and there ARE profiles,
      // Fallback to a profile, prioritizing the first in the list
      newId = state.profiles.availableProfiles[0].id;
    }
  }

  // Only update if there's a change
  if ((newId ?? null) !== (initialId ?? null)) {
    dispatch(setSelectedProfile(newId));
    extra.ideMessenger.post("didChangeSelectedProfile", {
      id: newId,
    });
  }
});

export const cycleProfile = createAsyncThunk<void, undefined, ThunkApiType>(
  "profiles/cycle",
  async (_, { dispatch, getState }) => {
    const state = getState();

    if (state.profiles.availableProfiles === null) {
      return;
    }

    const profileIds = state.profiles.availableProfiles.map(
      (profile) => profile.id,
    );
    // In case of no profiles just does nothing
    if (profileIds.length === 0) {
      return;
    }
    let nextId = profileIds[0];
    if (state.profiles.selectedProfileId) {
      const curIndex = profileIds.indexOf(state.profiles.selectedProfileId);
      const nextIndex = (curIndex + 1) % profileIds.length;
      nextId = profileIds[nextIndex];
    }
    await dispatch(selectProfileThunk(nextId));
  },
);

export const updateProfilesThunk = createAsyncThunk<
  void,
  { profiles: ProfileDescription[] | null; selectedProfileId: string | null },
  ThunkApiType
>("profiles/update", async (data, { dispatch, extra, getState }) => {
  const { profiles, selectedProfileId } = data;

  dispatch(setAvailableProfiles(profiles));

  // This will trigger reselection if needed
  dispatch(selectProfileThunk(selectedProfileId));
});

export const selectOrgThunk = createAsyncThunk<
  void,
  string | null,
  ThunkApiType
>("session/selectOrg", async (id, { dispatch, extra, getState }) => {
  const state = getState();
  const initialId = state.profiles.selectedOrganizationId;
  let newId = id;

  // If no orgs, force clear
  if (state.profiles.organizations.length === 0) {
    newId = null;
  } else if (newId) {
    // If new id doesn't match an existing org, clear it
    if (!state.profiles.organizations.find((o) => o.id === newId)) {
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
>("session/updateOrgs", async (orgs, { dispatch, getState }) => {
  const state = getState();
  dispatch(setOrganizations(orgs));

  // This will trigger reselection if needed
  dispatch(selectOrgThunk(state.profiles.selectedOrganizationId));
});
