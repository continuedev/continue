import { OnboardingModes } from "core/protocol/core";
import { useContext } from "react";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { getLocalStorage, setLocalStorage } from "../../../util/localStorage";
import { useOnboardingCard } from "./useOnboardingCard";

export function useSubmitOnboarding(mode: OnboardingModes, isDialog = false) {
  const ideMessenger = useContext(IdeMessengerContext);
  const { close: closeOnboardingCard } = useOnboardingCard();

  /** The Local tab: write the Ollama setup to config.yaml and close the card. */
  function submitOnboarding() {
    const onboardingStatus = getLocalStorage("onboardingStatus");

    // Always close the onboarding card and update config.yaml
    closeOnboardingCard(isDialog);

    ideMessenger.post("onboarding/complete", { mode });

    if (onboardingStatus === "Started") {
      // Local state
      setLocalStorage("onboardingStatus", "Completed");

      // Move to next step in onboarding
      ideMessenger.post("showTutorial", undefined);
    }

    ideMessenger.post("config/openProfile", { profileId: undefined });
  }

  /**
   * The provider setup flow has already written config.yaml, so only the
   * card and the first-run bookkeeping are left.
   */
  function finishOnboarding() {
    const onboardingStatus = getLocalStorage("onboardingStatus");
    closeOnboardingCard(isDialog);
    if (onboardingStatus === "Started") {
      setLocalStorage("onboardingStatus", "Completed");
      ideMessenger.post("showTutorial", undefined);
    }
  }

  return {
    submitOnboarding,
    finishOnboarding,
  };
}
