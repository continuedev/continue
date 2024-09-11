import { usePostHog } from "posthog-js/react";
import { getLocalStorage, setLocalStorage } from "../../util/localStorage";
import { useDispatch, useSelector } from "react-redux";
import { setOnboardingCard } from "../../redux/slices/uiStateSlice";
import { useContext } from "react";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { RootState } from "../../redux/store";
import { OnboardingCardState } from "./OnboardingCard";

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

export function useOnboardingCard(): OnboardingCardState {
  const onboardingStatus = getLocalStorage("onboardingStatus");
  const hasDismissedOnboardingCard = getLocalStorage(
    "hasDismissedOnboardingCard",
  );

  const onboardingCard = useSelector(
    (state: RootState) => state.uiState.onboardingCard,
  );

  let show: boolean;

  // Always show if we explicitly want to, e.g. passing free trial
  // and setting up keys
  if (onboardingCard.show) {
    show = true;
  } else {
    show = onboardingStatus !== "Completed" && !hasDismissedOnboardingCard;
  }

  return { show, activeTab: onboardingCard.activeTab };
}

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
