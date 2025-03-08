import { createAsyncThunk } from "@reduxjs/toolkit";
import StreamErrorDialog from "../../pages/gui/StreamError";
import { clearLastEmptyResponse, setInactive } from "../slices/sessionSlice";
import { setDialogMessage, setShowDialog } from "../slices/uiSlice";
import { ThunkApiType } from "../store";
import { saveCurrentSession } from "./session";

export const streamThunkWrapper = createAsyncThunk<
  void,
  () => Promise<void>,
  ThunkApiType
>("chat/streamWrapper", async (runStream, { dispatch, extra, getState }) => {
  try {
    await runStream();
  } catch (e: unknown) {
    dispatch(clearLastEmptyResponse());
    dispatch(setDialogMessage(<StreamErrorDialog error={e} />));
    dispatch(setShowDialog(true));
  } finally {
    dispatch(setInactive());
    const state = getState();
    if (state.session.mode === "chat") {
      await dispatch(
        saveCurrentSession({
          openNewSession: false,
          generateTitle: true,
        }),
      );
    }
  }
});
