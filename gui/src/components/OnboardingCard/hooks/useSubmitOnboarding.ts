import { usePostHog } from "posthog-js/react";
import { useContext } from "react";
import { useDispatch } from "react-redux";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { setOnboardingCard } from "../../../redux/slices/uiStateSlice";
import { getLocalStorage, setLocalStorage } from "../../../util/localStorage";
import { OnboardingModes } from "core/protocol/core";
import { useTutorialCard } from "../../../hooks/useTutorialCard";

export function useSubmitOnboarding(mode: OnboardingModes) {
  const posthog = usePostHog();
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const { openTutorialCard } = useTutorialCard();

  function submitOnboarding() {
    debugger;
    const onboardingStatus = getLocalStorage("onboardingStatus");

    // Always close the onboarding card and update config.json
    dispatch(setOnboardingCard({ show: false }));
    ideMessenger.post("completeOnboarding", {
      mode,
    });

    if (onboardingStatus === "Started") {
      // Telemetry
      posthog.capture("Onboarding Step", { status: "Completed" });
      posthog.capture("onboardingSelection", {
        mode,
      });

      // Local state
      setLocalStorage("onboardingStatus", "Completed");

      // Show tutorial card
      openTutorialCard();

      // Move to next step in onboarding
      ideMessenger.post("showTutorial", undefined);
    }
  }

  return {
    submitOnboarding,
  };
}
