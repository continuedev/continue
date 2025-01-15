import { createAsyncThunk } from "@reduxjs/toolkit";
import { setSelectedProfileId } from "../slices/sessionSlice";
import { ThunkApiType } from "../store";

export const setProfileId = createAsyncThunk<void, string, ThunkApiType>(
  "profile/setId",
  async (id, { dispatch, extra }) => {
    dispatch(setSelectedProfileId(id));
    extra.ideMessenger.post("didChangeSelectedProfile", {
      id,
    });
  },
);
