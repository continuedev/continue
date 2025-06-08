import { createAsyncThunk } from "@reduxjs/toolkit";
import { setSelectedProfile } from "../slices";
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
>("selectFirstHubProfile", async (messages, { dispatch, extra, getState }) => {
  const state = getState();

  const currentOrgProfiles = state.profiles.organizations.find(
    (org) => org.id === (state.profiles.selectedOrganizationId ?? "personal"),
  );

  const firstHubProfile = currentOrgProfiles?.profiles.find(
    (profile) => profile.profileType === "platform",
  );

  if (!firstHubProfile) {
    return;
  }

  dispatch(setSelectedProfile(firstHubProfile.id));
  extra.ideMessenger.post("didChangeSelectedProfile", {
    id: firstHubProfile.id,
  });
});
