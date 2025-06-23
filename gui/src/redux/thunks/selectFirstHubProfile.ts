import { createAsyncThunk } from "@reduxjs/toolkit";
import { setSelectedProfile } from "../slices/profilesSlice";
import { ThunkApiType } from "../store";

/**
 * If there is a hub profile, select it.
 * Used primarily after onboarding when a new profile is created and we
 * want to switch to it immediately
 */
export const selectFirstHubProfile = createAsyncThunk<
  void,
  undefined,
  ThunkApiType
>("selectFirstHubProfile", async (_, { dispatch, extra, getState }) => {
  let attempts = 0;
  const maxAttempts = 3;

  const findAndSelectProfile = () => {
    const state = getState();

    const currentOrgProfiles = state.profiles.organizations.find(
      (org) => org.id === (state.profiles.selectedOrganizationId ?? "personal"),
    );

    const firstHubProfile = currentOrgProfiles?.profiles.find(
      (profile) => profile.profileType === "platform",
    );

    if (firstHubProfile) {
      dispatch(setSelectedProfile(firstHubProfile.id));
      extra.ideMessenger.post("didChangeSelectedProfile", {
        id: firstHubProfile.id,
      });
      return true;
    }

    return false;
  };

  // Try immediately first
  if (findAndSelectProfile()) {
    return;
  }

  // If not found, poll every second for up to maxAttempts
  return new Promise<void>((resolve) => {
    const interval = setInterval(() => {
      attempts++;

      if (findAndSelectProfile() || attempts >= maxAttempts) {
        clearInterval(interval);
        resolve();
      }
    }, 1000);
  });
});
