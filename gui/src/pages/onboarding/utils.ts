import { usePostHog } from "posthog-js/react";
import { getLocalStorage, setLocalStorage } from "../../util/localStorage";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Note that there is no "NotStarted" status since the
// local storage value is null until onboarding begins
export type OnboardingStatus = "Started" | "Completed";

// If there is no value in local storage for "onboardingStatus",
// it implies that the user has not begun or completed onboarding.
export function shouldBeginOnboarding() {
  const onboardingStatus = getLocalStorage("onboardingStatus");

  return onboardingStatus === undefined;
}

/**
 * Telemetry, status tracking, and routing logic for new user onboarding.
 */
export function useOnboarding() {
  const posthog = usePostHog();
  const navigate = useNavigate();

  const completeOnboarding = () => {
    const onboardingStatus = getLocalStorage("onboardingStatus");

    if (onboardingStatus === "Started") {
      setLocalStorage("onboardingStatus", "Completed");
      posthog.capture("Onboarding Step", { status: "Completed" });
    }

    navigate("/");
  };

  useEffect(() => {
    if (shouldBeginOnboarding()) {
      setLocalStorage("onboardingStatus", "Started");
      posthog.capture("Onboarding Step", { status: "Started" });
    }
  }, []);

  return {
    completeOnboarding,
  };
}
