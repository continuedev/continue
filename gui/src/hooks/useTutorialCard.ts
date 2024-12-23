import { useState } from "react";
import { getLocalStorage, setLocalStorage } from "../util/localStorage";
import { usePostHog } from "posthog-js/react";

export type UseTutorialCard = {
  showTutorialCard: boolean;
  closeTutorialCard: () => void;
  openTutorialCard: () => void;
};

export function useTutorialCard(): UseTutorialCard {
  const posthog = usePostHog();

  const [showTutorialCard, setShowTutorialCard] = useState<boolean>(
    getLocalStorage("showTutorialCard") ?? true,
  );

  function closeTutorialCard() {
    posthog.capture("closedTutorialCard");
    setLocalStorage("showTutorialCard", false);
    setShowTutorialCard(false);
  }

  function openTutorialCard() {
    setLocalStorage("showTutorialCard", true);
    setShowTutorialCard(true);
  }

  return { showTutorialCard, closeTutorialCard, openTutorialCard };
}

export default UseTutorialCard;
