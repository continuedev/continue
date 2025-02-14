import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  setSelectedOrganizationId,
  setSelectedProfileId,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { ControlPlaneSessionInfo } from "core/control-plane/client";
import { ProfileDescription } from "core/config/ConfigHandler";
import { OrganizationDescription } from "core/config/ProfileLifecycleManager";

export const cycleProfile = createAsyncThunk<void, undefined, ThunkApiType>(
  "profiles/cycle",
  async (_, { dispatch, getState, extra }) => {
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

export const selectProfileThunk = createAsyncThunk<
  void,
  string | null,
  ThunkApiType
>("profiles/select", async (id, { dispatch, extra }) => {
  dispatch(setSelectedProfileId(id));
  extra.ideMessenger.post("didChangeSelectedProfile", {
    id,
  });
});

export const updateProfilesThunk = createAsyncThunk<
  void,
  ProfileDescription[],
  ThunkApiType
>("profiles/update", async (profiles, { dispatch, extra }) => {
  // dispatch(setSelectedOrganizationId(id));
  // extra.ideMessenger.post("didChangeSelectedOrg", {
  //   id,
  // });
});

export const selectOrgThunk = createAsyncThunk<
  void,
  string | null,
  ThunkApiType
>("session/selectOrg", async (id, { dispatch, extra }) => {
  dispatch(setSelectedOrganizationId(id));
  extra.ideMessenger.post("didChangeSelectedOrg", {
    id,
  });
});

export const updateOrgsThunk = createAsyncThunk<
  void,
  OrganizationDescription[],
  ThunkApiType
>("session/updateOrgs", async (session, { dispatch, extra }) => {
  // dispatch(setSelectedOrganizationId(id));
  // extra.ideMessenger.post("didChangeSelectedOrg", {
  //   id,
  // });
});
