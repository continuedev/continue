import { ProfilesState } from "./slice";

export function ensureProfilePreferences(
  state: ProfilesState,
  profileId: string,
) {
  if (!state.preferencesByProfileId[profileId]) {
    state.preferencesByProfileId[profileId] = {
      bookmarksByName: [],
    };
  }
}
