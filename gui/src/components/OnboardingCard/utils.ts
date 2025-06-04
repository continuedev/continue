import { OnboardingModes } from "core/protocol/core";
import { getLocalStorage, setLocalStorage } from "../../util/localStorage";
import { OnboardingCardState } from "./OnboardingCard";

export type OnboardingStatus = "Started" | "Completed";

export function isNewUserOnboarding() {
  const onboardingCompleteLegacyValue =
    localStorage.getItem("onboardingComplete");

  if (onboardingCompleteLegacyValue === "true") {
    setLocalStorage("onboardingStatus", "Completed");
    localStorage.removeItem("onboardingComplete");
  }

  const onboardingStatus = getLocalStorage("onboardingStatus");

  return onboardingStatus === undefined;
}

export const defaultOnboardingCardState: OnboardingCardState = {
  show: false,
  activeTab: OnboardingModes.API_KEYS,
};

export enum OllamaConnectionStatuses {
  WaitingToDownload = "WaitingToDownload",
  Downloading = "Downloading",
  Connected = "Connected",
}
