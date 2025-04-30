import { createAsyncThunk } from "@reduxjs/toolkit";
import { JSONContent } from "@tiptap/core";
import { CodeToEdit, MessageModes, RangeInFileWithContents } from "core";
import { stripImages } from "core/util/messageContent";
import { resolveEditorContent } from "../../components/mainInput/TipTapEditor";
import {
  clearCodeToEdit,
  setEditStateApplyStatus,
  setReturnCursorToEditorAfterEdit,
  setReturnToModeAfterEdit,
} from "../slices/editModeState";
import { newSession, setMode } from "../slices/sessionSlice";
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

        dispatch(setEditStateApplyStatus("streaming"));
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

    for (const code of codeToEdit) {
      extra.ideMessenger.post("rejectDiff", {
        filepath: code.filepath,
      });
    }

    dispatch(clearCodeToEdit());

    if (openNewSession) {
      dispatch(newSession());
    } else {
      await dispatch(
        loadLastSession({
          saveCurrentSession: false,
        }),
      );
    }

    dispatch(setMode(goToMode ?? state.editModeState.returnToMode));

    extra.ideMessenger.post("edit/clearDecorations", {
      shouldFocusEditor: state.editModeState.returnCursorToEditorAfterEdit,
    });
  },
);

export const enterEditMode = createAsyncThunk<
  void,
  { returnToMode?: MessageModes; returnCursorToEditor?: boolean },
  ThunkApiType
>(
  "edit/enterMode",
  async (
    { returnCursorToEditor, returnToMode },
    { dispatch, extra, getState },
  ) => {
    const state = getState();

    dispatch(setReturnToModeAfterEdit(returnToMode ?? state.session.mode));
    dispatch(setReturnCursorToEditorAfterEdit(returnCursorToEditor ?? false));

    if (state.session.mode === "edit") {
      return;
    }

    await dispatch(
      saveCurrentSession({
        openNewSession: true,
        // Because this causes a lag before Edit mode is focused. TODO just have that happen in background
        generateTitle: false,
      }),
    );
    dispatch(setEditStateApplyStatus("not-started"));
    dispatch(setMode("edit"));
  },
);
