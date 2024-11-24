import { createAsyncThunk } from "@reduxjs/toolkit";
import { setInactive } from "../slices/stateSlice";
import { ThunkApiType } from "../store";

export const handleErrors = createAsyncThunk<
  void,
  () => Promise<void>,
  ThunkApiType
>("chat/handleErrors", async (runStream, { dispatch, extra }) => {
  try {
    await runStream();
  } catch (e: any) {
    console.debug("Error streaming response: ", e);
    extra.ideMessenger.post("showToast", [
      "error",
      `Error streaming response: ${e.message}`,
    ]);
  } finally {
    dispatch(setInactive());
    // triggerSave(!save); TODO
  }
});
