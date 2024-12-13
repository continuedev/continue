import { createAsyncThunk } from "@reduxjs/toolkit";
import { clearLastEmptyResponse, setInactive } from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { saveCurrentSession } from "./session";

export const streamThunkWrapper = createAsyncThunk<
  void,
  () => Promise<void>,
  ThunkApiType
>("chat/streamWrapper", async (runStream, { dispatch, extra }) => {
  try {
    await runStream();
  } catch (e: any) {
    // NOTE - streaming errors are shown as ide toasts in core, don't show duplicate here
    console.debug("Error streaming response: ", e);
    dispatch(clearLastEmptyResponse());
  } finally {
    dispatch(setInactive());
    await dispatch(
      saveCurrentSession({
        openNewSession: false,
      }),
    );
  }
});
