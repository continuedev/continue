import { OnboardingModes } from "core/protocol/core";
import { usePostHog } from "posthog-js/react";
import { useContext } from "react";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { getLocalStorage, setLocalStorage } from "../../../util/localStorage";
import { useLump } from "../../mainInput/Lump/LumpContext";
import { useOnboardingCard } from "./useOnboardingCard";

export function useSubmitOnboarding(mode: OnboardingModes, isDialog = false) {
  const posthog = usePostHog();
  const ideMessenger = useContext(IdeMessengerContext);
  const { close: closeOnboardingCard } = useOnboardingCard();
  const { setSelectedSection } = useLump();

  function submitOnboarding(provider?: string, apiKey?: string) {
    const onboardingStatus = getLocalStorage("onboardingStatus");

    // Always close the onboarding card and update config.yaml
    closeOnboardingCard(isDialog);

    ideMessenger.post("onboarding/complete", {
      mode,
      provider,
      apiKey,
    });

    if (onboardingStatus === "Started") {
      // Telemetry
      posthog.capture("Onboarding Step", { status: "Completed" });
      posthog.capture("onboardingSelection", {
        mode,
      });

      // Local state
      setLocalStorage("onboardingStatus", "Completed");

      // Move to next step in onboarding
      ideMessenger.post("showTutorial", undefined);
    }

    ideMessenger.post("config/openProfile", { profileId: undefined });
    setSelectedSection("models");
  }

  return {
    submitOnboarding,
  };
}
