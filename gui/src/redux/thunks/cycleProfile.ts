import { createAsyncThunk } from "@reduxjs/toolkit";
import { ThunkApiType } from "../store";
import { setProfileId } from "./setProfileId";

export const cycleProfile = createAsyncThunk<void, undefined, ThunkApiType>(
  "profile/cycle",
  async (_, { dispatch, getState, extra }) => {
    const state = getState();
    const profileIds = state.session.availableProfiles.map(
      (profile) => profile.id,
    );
    if (profileIds.length === 0) {
      return;
    }
    let nextId = profileIds[0];
    if (state.session.selectedProfileId) {
      const curIndex = profileIds.indexOf(state.session.selectedProfileId);
      const nextIndex = (curIndex + 1) % profileIds.length;
      nextId = profileIds[nextIndex];
    }
    await dispatch(setProfileId(nextId));
  },
);
