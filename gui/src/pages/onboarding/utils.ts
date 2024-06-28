import { usePostHog } from "posthog-js/react";
import { getLocalStorage, setLocalStorage } from "../../util/localStorage";
import { useEffect, useState } from "react";

export function useCaptureNewUserOnboardingStarted() {
  const posthog = usePostHog();

  const [captureNewUserOnboardingStarted, setCaptureNewUserOnboardingStarted] =
    useState<Function | undefined>(undefined);

  useEffect(() => {
    // This is a heuristic. Currently, in `gui/src/components/Layout.tsx`.
    // we check this local storage key to determine if we should show the
    // onboarding page to a new user.
    const isExistingUser = getLocalStorage("onboardingComplete");

    if (!isExistingUser) {
      setCaptureNewUserOnboardingStarted(() => {
        return () => {
          debugger;
          setLocalStorage("newUserOnboardingInProgress", true);
          posthog.capture("newUserOnboardingStarted");
        };
      });
    }
  }, []);

  return { captureNewUserOnboardingStarted };
}

export function useCaptureNewUserOnboardingCompleted() {
  const posthog = usePostHog();

  const [
    captureNewUserOnboardingComplete,
    setCaptureNewUserOnboardingComplete,
  ] = useState<Function | undefined>(undefined);

  useEffect(() => {
    const isNewUserOnboardingInProgress = getLocalStorage(
      "newUserOnboardingInProgress",
    );

    if (isNewUserOnboardingInProgress) {
      setCaptureNewUserOnboardingComplete(() => {
        return () => {
          debugger;
          setLocalStorage("newUserOnboardingInProgress", false);
          posthog.capture("newUserOnboardingCompleted");
        };
      });
    }
  }, []);

  return { captureNewUserOnboardingComplete };
}
