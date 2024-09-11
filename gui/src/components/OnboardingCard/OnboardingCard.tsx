import { useContext, useState } from "react";
import * as Tabs from "./tabs";
import OnboardingCardTabs, {
  TabTitle,
  TabTitles,
} from "./components/OnboardingCardTabs";
import { XMarkIcon } from "@heroicons/react/24/outline";
import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  parseColorForHex,
  VSC_FOREGROUND_VAR,
  vscBackground,
  vscForeground,
  vscInputBackground,
} from "../";
import { getLocalStorage, setLocalStorage } from "../../util/localStorage";
import { hasPassedFTL } from "../../util/freeTrial";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useCompleteOnboarding } from "./utils";

const StyledCard = styled.div`
  margin: auto;
  border-radius: ${defaultBorderRadius};
  padding: 1rem 1.5rem;
  background-color: ${vscInputBackground};
  box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1),
    0 8px 10px -6px rgb(0 0 0 / 0.1);
`;

const CloseButton = styled.button`
  border: none;
  background-color: inherit;
  color: ${lightGray};
  position: absolute;
  top: 0.6rem;
  right: 1rem;
  padding: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
`;

function OnboardingCard() {
  const ideMessenger = useContext(IdeMessengerContext);
  const { completeOnboarding } = useCompleteOnboarding();

  const [activeTab, setActiveTab] = useState<TabTitle>(
    hasPassedFTL() ? "Best" : "Quickstart",
  );

  const [isCardVisible, setIsCardVisible] = useState(
    getLocalStorage("showOnboardingCard") ?? true,
  );

  function handleTabClick(tabName) {
    setActiveTab(tabName);
  }

  function handleClose() {
    setLocalStorage("showOnboardingCard", false);
    setIsCardVisible(false);
  }

  function onComplete() {
    ideMessenger.post("showTutorial", undefined);
    setLocalStorage("showTutorialCard", true);
    setLocalStorage("showOnboardingCard", false);
    completeOnboarding();
    setIsCardVisible(false);
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "Quickstart":
        return <Tabs.Quickstart onComplete={onComplete} />;
      case "Best":
        return <Tabs.Best onComplete={onComplete} />;
      case "Local":
        return <Tabs.Local onComplete={onComplete} />;
      default:
        return null;
    }
  };

  if (!isCardVisible) {
    return null;
  }

  return (
    <StyledCard className="relative">
      <OnboardingCardTabs activeTab={activeTab} onTabClick={handleTabClick} />
      <CloseButton onClick={handleClose}>
        <XMarkIcon className="h-5 w-5" />
      </CloseButton>
      <div className="content py-4">{renderTabContent()}</div>
    </StyledCard>
  );
}

export default OnboardingCard;
