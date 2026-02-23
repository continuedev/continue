import { ModelRole } from "@continuedev/config-yaml";
import { createAsyncThunk } from "@reduxjs/toolkit";
import { ProfileDescription } from "core/config/ProfileLifecycleManager";
import { updateConfig } from "../slices/configSlice";
import { ThunkApiType } from "../store";

export const updateSelectedModelByRole = createAsyncThunk<
  void,
  {
    role: ModelRole;
    modelTitle: string;
    selectedProfile: ProfileDescription | null;
  },
  ThunkApiType
>(
  "config/updateSelectedModel",
  async (
    { role, modelTitle, selectedProfile },
    { dispatch, extra, getState },
  ) => {
    if (!selectedProfile) {
      return;
    }

    const state = getState();

    const {
      config: { config },
    } = state;

    const model = state.config.config.modelsByRole[role]?.find(
      (m) => m.title === modelTitle,
    );

    if (!model) {
      console.error(
        `Model with title "${modelTitle}" not found for role "${role}"`,
      );
      return;
    }

    dispatch(
      updateConfig({
        ...config,
        selectedModelByRole: {
          ...config.selectedModelByRole,
          [role]: model,
        },
      }),
    );

    extra.ideMessenger.post("config/updateSelectedModel", {
      role,
      profileId: selectedProfile.id,
      title: modelTitle,
    });
  },
);
