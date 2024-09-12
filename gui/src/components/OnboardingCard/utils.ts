import { getLocalStorage, setLocalStorage } from "../../util/localStorage";

// Note that there is no "NotStarted" status since the
// local storage value is null until onboarding begins
export type OnboardingStatus = "Started" | "Completed";

// If there is no value in local storage for "onboardingStatus",
// it implies that the user has not begun or completed onboarding.
export function isNewUserOnboarding() {
  // We used to use "onboardingComplete", but switched to "onboardingStatus"
  const onboardingCompleteLegacyValue =
    localStorage.getItem("onboardingComplete");

  if (onboardingCompleteLegacyValue === "true") {
    setLocalStorage("onboardingStatus", "Completed");
    localStorage.removeItem("onboardingComplete");
  }

  const onboardingStatus = getLocalStorage("onboardingStatus");

  return onboardingStatus === undefined;
}
