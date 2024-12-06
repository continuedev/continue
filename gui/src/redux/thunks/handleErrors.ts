import { createAsyncThunk } from "@reduxjs/toolkit";
import { clearLastEmptyResponse, setInactive } from "../slices/sessionSlice";
import { ThunkApiType } from "../store";

export const handleStreamErrors = createAsyncThunk<
  void,
  () => Promise<void>,
  ThunkApiType
>("chat/handleStreamErrors", async (runStream, { dispatch, extra }) => {
  try {
    await runStream();
  } catch (e: any) {
    // NOTE - streaming errors are shown as ide toasts in core, don't show duplicate here
    console.error("Error streaming response: ", e);
  } finally {
    dispatch(clearLastEmptyResponse());
    dispatch(setInactive());
    // triggerSave(!save); TODO
  }
});
