import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  clearLastEmptyResponse,
  setInactive,
  setStreamError,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { saveCurrentSession } from "./session";

export const streamThunkWrapper = createAsyncThunk<
  void,
  () => Promise<void>,
  ThunkApiType
>("chat/streamWrapper", async (runStream, { dispatch, extra }) => {
  try {
    dispatch(setStreamError(undefined));
    await runStream();
  } catch (e: any) {
    // NOTE - streaming errors are shown as ide toasts in core, don't show duplicate here
    // console.debug("Error streaming response: ", e);
    if (e.message) {
      const status = e.message.split(" ")[0];
      if (status) {
        console.log("STATUS", status);
        const statusCode = Number(status);
        dispatch(
          setStreamError({
            message: e.message,
            statusCode: Number.isNaN(statusCode) ? 500 : statusCode,
          }),
        );
      }
    }
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
