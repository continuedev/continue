import { createAsyncThunk } from "@reduxjs/toolkit";
import { JSONContent } from "@tiptap/core";
import {
  MessageModes,
  RangeInFileWithContents,
  SetCodeToEditPayload,
} from "core";
import { stripImages } from "core/util/messageContent";
import { resolveEditorContent } from "../../components/mainInput/TipTapEditor";
import {
  clearCodeToEdit,
  INITIAL_EDIT_APPLY_STATE,
  setPreviousModeEditorContent,
  setReturnToModeAfterEdit,
  updateEditStateApplyState,
} from "../slices/editState";
import {
  newSession,
  setActive,
  setInactive,
  setIsInEdit,
  setMainEditorContentTrigger,
  setMode,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { loadLastSession, saveCurrentSession } from "./session";
import { streamThunkWrapper } from "./streamThunkWrapper";

export const streamEditThunk = createAsyncThunk<
  void,
  {
    editorState: JSONContent;
    codeToEdit: SetCodeToEditPayload[];
  },
  ThunkApiType
>(
  "edit/streamResponse",
  async ({ editorState, codeToEdit }, { dispatch, extra, getState }) => {
    await dispatch(
      streamThunkWrapper(async () => {
        dispatch(setActive());

        const { selectedContextItems, content } = await resolveEditorContent({
          editorState,
          modifiers: {
            noContext: true,
            useCodebase: false,
          },
          ideMessenger: extra.ideMessenger,
          defaultContextProviders: [],
          availableSlashCommands: [],
          dispatch,
          getState,
        });

        const prompt = [
          ...selectedContextItems.map((item) => item.content),
          stripImages(content),
        ].join("\n\n");

        const response = await extra.ideMessenger.request("edit/sendPrompt", {
          prompt,
          range: codeToEdit[0] as RangeInFileWithContents,
        });

        dispatch(setInactive());

        if (response.status === "error") {
          throw new Error(response.error);
        }
      }),
    );
  },
);

export const exitEdit = createAsyncThunk<
  void,
  { openNewSession?: boolean },
  ThunkApiType
>("edit/exit", async ({ openNewSession }, { dispatch, extra, getState }) => {
  const state = getState();
  const codeToEdit = state.editModeState.codeToEdit;
  const isInEdit = state.session.isInEdit;
  const previousModeEditorContent =
    state.editModeState.previousModeEditorContent;

  if (!isInEdit) {
    return;
  }

  if (codeToEdit[0] && state.editModeState.applyState.numDiffs) {
    extra.ideMessenger.post("rejectDiff", {
      filepath: codeToEdit[0].filepath,
    });
  }

  extra.ideMessenger.post("edit/clearDecorations", undefined);

  dispatch(clearCodeToEdit());
  dispatch(updateEditStateApplyState(INITIAL_EDIT_APPLY_STATE));
  dispatch(setIsInEdit(false));

  // Restore the previous editor content if available
  if (previousModeEditorContent) {
    dispatch(setMainEditorContentTrigger(previousModeEditorContent));
    dispatch(setPreviousModeEditorContent(undefined));
  }

  if (openNewSession || state.editModeState.lastNonEditSessionWasEmpty) {
    dispatch(newSession());
  } else {
    await dispatch(loadLastSession());
  }

  dispatch(setMode(state.editModeState.returnToMode));
});

export const enterEdit = createAsyncThunk<
  void,
  { returnToMode?: MessageModes; editorContent?: JSONContent },
  ThunkApiType
>(
  "edit/enter",
  async ({ returnToMode, editorContent }, { dispatch, extra, getState }) => {
    const state = getState();
    const isInEdit = state.session.isInEdit;

    if (isInEdit) {
      return;
    }

    if (!state.editModeState.codeToEdit[0]) {
      extra.ideMessenger.post("showToast", [
        "info",
        "Please open a file to use Edit mode",
      ]);
      return;
    }

    dispatch(setMainEditorContentTrigger({}));
    dispatch(setPreviousModeEditorContent(editorContent));

    dispatch(setReturnToModeAfterEdit(returnToMode ?? state.session.mode));
    dispatch(updateEditStateApplyState(INITIAL_EDIT_APPLY_STATE));

    await dispatch(
      saveCurrentSession({
        openNewSession: true,
        // Because this causes a lag before Edit is focused. TODO just have that happen in background
        generateTitle: false,
      }),
    );

    dispatch(setIsInEdit(true));
  },
);
