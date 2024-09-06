import { usePostHog } from "posthog-js/react";
import { useNavigate } from "react-router-dom";
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

/**
 * Telemetry, status tracking, and routing logic for new user onboarding.
 */
export function useCompleteOnboarding() {
  const posthog = usePostHog();
  const navigate = useNavigate();

  function completeOnboarding() {
    const onboardingStatus = getLocalStorage("onboardingStatus");

    if (onboardingStatus === "Started") {
      setLocalStorage("onboardingStatus", "Completed");
      setLocalStorage("showTutorialCard", true);
      posthog.capture("Onboarding Step", { status: "Completed" });
    }

    navigate("/");
  }

  return {
    completeOnboarding,
  };
}
