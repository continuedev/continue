import * as Tabs from "./tabs";
import { TabTitle, OnboardingCardTabs } from "./components/OnboardingCardTabs";
import { XMarkIcon } from "@heroicons/react/24/outline";
import styled from "styled-components";
import { CloseButton, defaultBorderRadius, vscInputBackground } from "../";
import { getLocalStorage, setLocalStorage } from "../../util/localStorage";
import { useOnboardingCard } from "./hooks/useOnboardingCard";

const StyledCard = styled.div`
  margin: auto;
  border-radius: ${defaultBorderRadius};
  background-color: ${vscInputBackground};
  box-shadow:
    0 20px 25px -5px rgb(0 0 0 / 0.1),
    0 8px 10px -6px rgb(0 0 0 / 0.1);
`;

export interface OnboardingCardState {
  show?: boolean;
  activeTab?: TabTitle;
}

export function OnboardingCard() {
  const onboardingCard = useOnboardingCard();

  function renderTabContent() {
    switch (onboardingCard.activeTab) {
      case "Quickstart":
        return <Tabs.Quickstart />;
      case "Best":
        return <Tabs.Best />;
      case "Local":
        return <Tabs.Local />;
      default:
        return <Tabs.Quickstart />;
    }
  }

  if (getLocalStorage("onboardingStatus") === undefined) {
    setLocalStorage("onboardingStatus", "Started");
  }

  return (
    <StyledCard className="xs:py-4 xs:px-4 relative px-2 py-3">
      <OnboardingCardTabs
        activeTab={onboardingCard.activeTab || "Best"}
        onTabClick={onboardingCard.setActiveTab}
      />
      <CloseButton onClick={onboardingCard.close}>
        <XMarkIcon className="mt-1.5 hidden h-5 w-5 hover:brightness-125 sm:flex" />
      </CloseButton>
      <div className="content py-4">{renderTabContent()}</div>
    </StyledCard>
  );
}
