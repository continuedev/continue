import { usePostHog } from "posthog-js/react";
import { getLocalStorage, setLocalStorage } from "../../util/localStorage";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Note that there is no "NotStarted" status since the
// local storage value is null until onboarding begins
export type OnboardingStatus = "InProgress" | "Completed";

// If there is no value in local storage for "onboardingStatus",
// it implies that the user has not begun or completed onboarding.
export function shouldBeginOnboarding() {
  const onboardingStatus = getLocalStorage("onboardingStatus");

  return onboardingStatus === undefined;
}

// TODO: Comments about this both capturing telemetry,
// and setting state vars
export function useOnboarding() {
  const posthog = usePostHog();
  const navigate = useNavigate();

  const onboardingStatus = getLocalStorage("onboardingStatus");

  const completeOnboarding = () => {
    if (onboardingStatus === "InProgress") {
      setLocalStorage("onboardingStatus", "Completed");
      posthog.capture("onboardingStatus", { onboardingStatus });
    }

    navigate("/");
  };

  useEffect(() => {
    if (shouldBeginOnboarding()) {
      setLocalStorage("onboardingStatus", "InProgress");
      posthog.capture("onboardingStatus", { onboardingStatus });
    }
  }, []);

  return {
    completeOnboarding,
  };
}
