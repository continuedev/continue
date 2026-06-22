import { createAsyncThunk } from "@reduxjs/toolkit";
<<<<<<< HEAD
import posthog from "posthog-js";
import StreamErrorDialog from "../../pages/gui/StreamError";
import { analyzeError } from "../../util/errorAnalysis";
=======

import StreamErrorDialog from "../../pages/gui/StreamError";
import { analyzeError } from "../../util/errorAnalysis";

const OVERLOADED_RETRIES = 3;
const OVERLOADED_DELAY_MS = 2000;

function isOverloadedErrorMessage(message?: string): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes("overloaded") || lower.includes("529");
}
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
import { selectSelectedChatModel } from "../slices/configSlice";
import { setDialogMessage, setShowDialog } from "../slices/uiSlice";
import { ThunkApiType } from "../store";
import { cancelStream } from "./cancelStream";
import { saveCurrentSession } from "./session";

export const streamThunkWrapper = createAsyncThunk<
  void,
  () => Promise<void>,
  ThunkApiType
>("chat/streamWrapper", async (runStream, { dispatch, getState }) => {
<<<<<<< HEAD
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
  } catch (e) {
    const state = getState();
    const selectedModel = selectSelectedChatModel(state);
    const { parsedError, statusCode, modelTitle, providerName } = analyzeError(
      e,
      selectedModel,
    );

    await dispatch(cancelStream());
    dispatch(setDialogMessage(<StreamErrorDialog error={e} />));
    dispatch(setShowDialog(true));

    const errorData = {
      error_type: statusCode ? `HTTP ${statusCode}` : "Unknown",
      error_message: parsedError,
      model_provider: providerName,
      model_title: modelTitle,
    };

    posthog.capture("gui_stream_error", errorData);
=======
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
      const { message } = analyzeError(e, selectedModel);

      const shouldRetry =
        isOverloadedErrorMessage(message) && attempt < OVERLOADED_RETRIES;

      if (shouldRetry) {
        await dispatch(cancelStream());
        const delayMs = OVERLOADED_DELAY_MS * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        await dispatch(cancelStream());
      } else {
        await dispatch(cancelStream());
        dispatch(setDialogMessage(<StreamErrorDialog error={e} />));
        dispatch(setShowDialog(true));

        return;
      }
    }
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
  }
});
