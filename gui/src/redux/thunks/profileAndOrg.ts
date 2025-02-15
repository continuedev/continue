import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  setAvailableProfiles,
  setOrganizations,
  setSelectedOrganizationId,
  setSelectedProfileId,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { ProfileDescription } from "core/config/ConfigHandler";
import { OrganizationDescription } from "core/config/ProfileLifecycleManager";
import { isLocalProfile } from "../../util";

export const selectProfileThunk = createAsyncThunk<
  void,
  string | null,
  ThunkApiType
>("profiles/select", async (id, { dispatch, extra, getState }) => {
  const state = getState();
  const initialId = state.session.selectedProfileId;

  let newId = id;

  // If no profiles, force clear
  if (state.session.availableProfiles.length === 0) {
    newId = null;
  } else {
    // If new id doesn't match an existing profile, clear it
    if (newId) {
      if (!state.session.availableProfiles.find((p) => p.id === newId)) {
        newId = null;
      }
    }
    if (!newId) {
      // At this point if null ID and there ARE profiles,
      // Fallback to a profile, prioritizing local
      const localProfile = state.session.availableProfiles.find(isLocalProfile);
      if (localProfile) {
        newId = localProfile.id;
      } else {
        newId = state.session.availableProfiles[0].id;
      }
    }
  }

  // Only update if there's a change
  if (newId !== initialId) {
    dispatch(setSelectedProfileId(newId));
    extra.ideMessenger.post("didChangeSelectedProfile", {
      id: newId,
    });
  }
});

export const cycleProfile = createAsyncThunk<void, undefined, ThunkApiType>(
  "profiles/cycle",
  async (_, { dispatch, getState }) => {
    const state = getState();
    const profileIds = state.session.availableProfiles.map(
      (profile) => profile.id,
    );
    // In case of no profiles just does nothing
    if (profileIds.length === 0) {
      return;
    }
    let nextId = profileIds[0];
    if (state.session.selectedProfileId) {
      const curIndex = profileIds.indexOf(state.session.selectedProfileId);
      const nextIndex = (curIndex + 1) % profileIds.length;
      nextId = profileIds[nextIndex];
    }
    await dispatch(selectProfileThunk(nextId));
  },
);

export const updateProfilesThunk = createAsyncThunk<
  void,
  ProfileDescription[],
  ThunkApiType
>("profiles/update", async (profiles, { dispatch, extra, getState }) => {
  const state = getState();
  dispatch(setAvailableProfiles(profiles));

  // This will trigger reselection if needed
  dispatch(selectProfileThunk(state.session.selectedProfileId));
});

export const selectOrgThunk = createAsyncThunk<
  void,
  string | null,
  ThunkApiType
>("session/selectOrg", async (id, { dispatch, extra, getState }) => {
  const state = getState();
  const initialId = state.session.selectedOrganizationId;
  let newId = id;

  // If no orgs, force clear
  if (state.session.organizations.length === 0) {
    newId = null;
  } else if (newId) {
    // If new id doesn't match an existing org, clear it
    if (!state.session.organizations.find((o) => o.id === newId)) {
      newId = null;
    }
  }
  // Unlike profiles, don't fallback to the first org,
  // Fallback to Personal (org = null)

  if (initialId !== newId) {
    dispatch(setAvailableProfiles([]));
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
  dispatch(selectOrgThunk(state.session.selectedOrganizationId));
});
