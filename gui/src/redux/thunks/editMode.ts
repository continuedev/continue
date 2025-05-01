import { createAsyncThunk } from "@reduxjs/toolkit";
import { JSONContent } from "@tiptap/core";
import { CodeToEdit, MessageModes, RangeInFileWithContents } from "core";
import { stripImages } from "core/util/messageContent";
import { resolveEditorContent } from "../../components/mainInput/TipTapEditor";
import {
  clearCodeToEdit,
  INITIAL_EDIT_APPLY_STATE,
  setReturnToModeAfterEdit,
  updateEditStateApplyState,
} from "../slices/editModeState";
import { newSession, setActive, setMode } from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { loadLastSession, saveCurrentSession } from "./session";
import { streamThunkWrapper } from "./streamThunkWrapper";

export const streamEditThunk = createAsyncThunk<
  void,
  {
    editorState: JSONContent;
    codeToEdit: CodeToEdit[];
  },
  ThunkApiType
>(
  "chat/streamResponse",
  async ({ editorState, codeToEdit }, { dispatch, extra, getState }) => {
    await dispatch(
      streamThunkWrapper(async () => {
        dispatch(setActive());
        const [contextItems, __, userInstructions, _] =
          await resolveEditorContent({
            editorState,
            modifiers: {
              noContext: true,
              useCodebase: false,
            },
            ideMessenger: extra.ideMessenger,
            defaultContextProviders: [],
            availableSlashCommands: [],
            dispatch,
          });

        const prompt = [
          ...contextItems.map((item) => item.content),
          stripImages(userInstructions),
        ].join("\n\n");

        const response = await extra.ideMessenger.request("edit/sendPrompt", {
          prompt,
          range: codeToEdit[0] as RangeInFileWithContents,
        });

        if (response.status === "error") {
          throw new Error(response.error);
        }
      }),
    );
  },
);

export const exitEditMode = createAsyncThunk<
  void,
  { goToMode?: MessageModes; openNewSession?: boolean },
  ThunkApiType
>(
  "edit/exitMode",
  async ({ goToMode, openNewSession }, { dispatch, extra, getState }) => {
    const state = getState();
    const codeToEdit = state.editModeState.codeToEdit;

    if (state.session.mode !== "edit") {
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

    if (openNewSession || state.editModeState.lastNonEditSessionWasEmpty) {
      dispatch(newSession());
    } else {
      await dispatch(
        loadLastSession({
          saveCurrentSession: false,
        }),
      );
    }

    dispatch(setMode(goToMode ?? state.editModeState.returnToMode));
  },
);

export const enterEditMode = createAsyncThunk<
  void,
  { returnToMode?: MessageModes },
  ThunkApiType
>("edit/enterMode", async ({ returnToMode }, { dispatch, extra, getState }) => {
  const state = getState();

  if (state.session.mode === "edit") {
    return;
  }

  dispatch(setReturnToModeAfterEdit(returnToMode ?? state.session.mode));

  await dispatch(
    saveCurrentSession({
      openNewSession: true,
      // Because this causes a lag before Edit mode is focused. TODO just have that happen in background
      generateTitle: false,
    }),
  );
  dispatch(updateEditStateApplyState(INITIAL_EDIT_APPLY_STATE));
  dispatch(setMode("edit"));

  if (!state.editModeState.codeToEdit[0]) {
    extra.ideMessenger.post("edit/addCurrentSelection", undefined);
  }
});
