import { usePostHog } from "posthog-js/react";
import { useContext } from "react";
import { useDispatch } from "react-redux";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { setOnboardingCard } from "../../../redux/slices/uiStateSlice";
import { getLocalStorage, setLocalStorage } from "../../../util/localStorage";

export function useCompleteOnboarding() {
  const posthog = usePostHog();
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);

  function completeOnboarding() {
    const onboardingStatus = getLocalStorage("onboardingStatus");

    if (onboardingStatus === "Started") {
      // Telemetry
      posthog.capture("Onboarding Step", { status: "Completed" });

      // Local state
      setLocalStorage("onboardingStatus", "Completed");
      setLocalStorage("showTutorialCard", true);
      dispatch(setOnboardingCard({ show: false }));

      // Move to next step in onboarding
      ideMessenger.post("showTutorial", undefined);
    }
  }

  return {
    completeOnboarding,
  };
}
