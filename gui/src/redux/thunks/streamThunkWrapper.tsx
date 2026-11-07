import { createAsyncThunk } from "@reduxjs/toolkit";

import StreamErrorDialog from "../../pages/gui/StreamError";
import { analyzeError } from "../../util/errorAnalysis";
import { classifyRequestFailure } from "../../util/requestFailures";

const OVERLOADED_RETRIES = 3;
const OVERLOADED_DELAY_MS = 2000;

function isOverloadedErrorMessage(message?: string): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes("overloaded") || lower.includes("529");
}
import { selectSelectedChatModel } from "../slices/configSlice";
import {
  recordRequestFailure,
  setQueuePaused,
  setSteeredMessages,
} from "../slices/sessionSlice";
import { setDialogMessage, setShowDialog } from "../slices/uiSlice";
import { ThunkApiType } from "../store";
import { cancelStream } from "./cancelStream";
import { saveCurrentSession } from "./session";

export const streamThunkWrapper = createAsyncThunk<
  void,
  () => Promise<void>,
  ThunkApiType
>("chat/streamWrapper", async (runStream, { dispatch, getState }) => {
  for (let attempt = 0; attempt <= OVERLOADED_RETRIES; attempt++) {
    try {
      await runStream();
      const state = getState();
      if (!state.session.isInEdit) {
        await dispatch(
          saveCurrentSession({
            openNewSession: false,
            generateTitle: true,
          }),
        );
      }
      return;
    } catch (e) {
      // Get the selected model from the state for error analysis
      const state = getState();
      const selectedModel = selectSelectedChatModel(state);
      const { message, statusCode } = analyzeError(e, selectedModel);

      // Every failed attempt is noted for the session, including the ones
      // retried below. A request the user stopped is not a failure.
      const kind = classifyRequestFailure(message, statusCode);
      if (kind && selectedModel) {
        dispatch(
          recordRequestFailure({
            at: Date.now(),
            mode: state.session.mode,
            provider: selectedModel.provider,
            model: selectedModel.model,
            kind,
            ...(statusCode !== undefined && { status: statusCode }),
          }),
        );
      }

      const shouldRetry =
        isOverloadedErrorMessage(message) && attempt < OVERLOADED_RETRIES;

      if (shouldRetry) {
        // cancelStream pauses the message queue as if the user stopped; a
        // retry is not a stop, so put the queue back as it was
        const wasQueuePaused = getState().session.isQueuePaused;
        const steeredIds = (getState().session.queuedMessages ?? [])
          .filter((m) => m.steer)
          .map((m) => m.id);
        await dispatch(cancelStream());
        const delayMs = OVERLOADED_DELAY_MS * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        await dispatch(cancelStream());
        dispatch(setQueuePaused(wasQueuePaused));
        dispatch(setSteeredMessages(steeredIds));
      } else {
        await dispatch(cancelStream());
        dispatch(setDialogMessage(<StreamErrorDialog error={e} />));
        dispatch(setShowDialog(true));

        return;
      }
    }
  }
});
