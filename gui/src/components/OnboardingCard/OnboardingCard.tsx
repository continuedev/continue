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
  box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1),
    0 8px 10px -6px rgb(0 0 0 / 0.1);
`;

export interface OnboardingCardState {
  show?: boolean;
  activeTab?: TabTitle;
}

export type OnboardingCardProps = Pick<OnboardingCardState, "activeTab">;

export function OnboardingCard(props: OnboardingCardProps) {
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
        return null;
    }
  }

  if (getLocalStorage("onboardingStatus") === undefined) {
    setLocalStorage("onboardingStatus", "Started");
  }

  return (
    <StyledCard className="relative px-2 py-3 xs:py-4 xs:px-4">
      <OnboardingCardTabs
        activeTab={onboardingCard.activeTab}
        onTabClick={onboardingCard.setActiveTab}
      />
      <CloseButton onClick={onboardingCard.close}>
        <XMarkIcon className="h-5 w-5 hidden sm:flex" />
      </CloseButton>
      <div className="content py-4">{renderTabContent()}</div>
    </StyledCard>
  );
}
