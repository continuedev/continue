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
    const curIndex = profileIds.indexOf(state.session.selectedProfileId);
    const nextIndex = (curIndex + 1) % profileIds.length;
    const nextId = profileIds[nextIndex];
    dispatch(setProfileId(nextId));

    extra.ideMessenger.post("didChangeSelectedProfile", {
      id: nextId,
    });
  },
);
