import { createAsyncThunk } from "@reduxjs/toolkit";
import { setSelectedOrganizationId } from "../slices/sessionSlice";
import { ThunkApiType } from "../store";

export const setOrgId = createAsyncThunk<void, string | null, ThunkApiType>(
  "profile/setOrgId",
  async (id, { dispatch, extra }) => {
    dispatch(setSelectedOrganizationId(id));
    extra.ideMessenger.post("didChangeSelectedOrg", {
      id,
    });
  },
);
