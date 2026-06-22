import { OnboardingModes } from "core/protocol/core";
<<<<<<< HEAD
import { usePostHog } from "posthog-js/react";
=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
import { useContext } from "react";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { getLocalStorage, setLocalStorage } from "../../../util/localStorage";
import { useOnboardingCard } from "./useOnboardingCard";

export function useSubmitOnboarding(mode: OnboardingModes, isDialog = false) {
<<<<<<< HEAD
  const posthog = usePostHog();
=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
  const ideMessenger = useContext(IdeMessengerContext);
  const { close: closeOnboardingCard } = useOnboardingCard();

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
<<<<<<< HEAD
      // Telemetry
      posthog.capture("Onboarding Step", { status: "Completed" });
      posthog.capture("onboardingSelection", {
        mode,
      });

=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
      // Local state
      setLocalStorage("onboardingStatus", "Completed");

      // Move to next step in onboarding
      ideMessenger.post("showTutorial", undefined);
    }

    ideMessenger.post("config/openProfile", { profileId: undefined });
  }

  return {
    submitOnboarding,
  };
}
