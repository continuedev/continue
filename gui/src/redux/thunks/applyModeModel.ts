import { MessageModes, ModelUse } from "core";
import { createAsyncThunk } from "@reduxjs/toolkit";
import { getModeModelTitle } from "../../util/modeModels";
import { selectSelectedProfile } from "../slices/profilesSlice";
import { ThunkApiType } from "../store";
import { updateSelectedModelByRole } from "./updateSelectedModelByRole";

/**
 * Switch the selected chat model to the one configured for `mode` (a mode, or
 * a use such as a Loop item or re-plan: `modeModels` in config.yaml, or the
 * user's manual pick for that mode), or to `title` when given: a Loop item's
 * own model (TaskItem.model), already resolved against the chat models. Does
 * nothing when the use has no model or it is already selected. The profile
 * defaults to the selected one.
 */
export const applyModeModel = createAsyncThunk<
  void,
  {
    mode: MessageModes | ModelUse;
    selectedProfile?: Parameters<
      typeof updateSelectedModelByRole
    >[0]["selectedProfile"];
    /** A model to select instead of the mode's own */
    title?: string;
  },
  ThunkApiType
>(
  "config/applyModeModel",
  async ({ mode, selectedProfile, title: own }, { dispatch, getState }) => {
    const state = getState();
    const title =
      own ??
      getModeModelTitle(state.config.config, mode, state.ui.modeModelOverrides);
    if (!title) return;
    if (state.config.config.selectedModelByRole.chat?.title === title) return;
    if (!state.config.config.modelsByRole.chat.some((m) => m.title === title)) {
      return;
    }
    await dispatch(
      updateSelectedModelByRole({
        role: "chat",
        modelTitle: title,
        selectedProfile: selectedProfile ?? selectSelectedProfile(state),
      }),
    );
  },
);
