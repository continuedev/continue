import { createAsyncThunk } from "@reduxjs/toolkit";
import { setInactive } from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { saveCurrentSession } from "./session";

export const handleErrors = createAsyncThunk<
  void,
  () => Promise<void>,
  ThunkApiType
>("chat/handleErrors", async (runStream, { dispatch, extra }) => {
  try {
    await runStream();
  } catch (e: any) {
    console.debug("Error streaming response: ", e);
  } finally {
    dispatch(setInactive());
    // NOTE will conflict with dallin/silent-chat-errors, move this dispatch to the streamWrapper on that version
    await dispatch(
      saveCurrentSession({
        openNewSession: false,
      }),
    );
  }
});
