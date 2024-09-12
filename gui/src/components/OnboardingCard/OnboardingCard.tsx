import { useState } from "react";
import * as Tabs from "./tabs";
import OnboardingCardTabs, { TabTitle } from "./components/OnboardingCardTabs";
import { XMarkIcon } from "@heroicons/react/24/outline";
import styled from "styled-components";
import {
  CloseButton,
  defaultBorderRadius,
  lightGray,
  vscInputBackground,
} from "../";
import { useDispatch } from "react-redux";
import { setOnboardingCard } from "../../redux/slices/uiStateSlice";
import { getLocalStorage, setLocalStorage } from "../../util/localStorage";

const StyledCard = styled.div`
  margin: auto;
  border-radius: ${defaultBorderRadius};
  padding: 1rem 1.5rem;
  background-color: ${vscInputBackground};
  box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1),
    0 8px 10px -6px rgb(0 0 0 / 0.1);
`;

export interface OnboardingCardState {
  show?: boolean;
  activeTab?: TabTitle;
}

export const defaultOnboardingCardState: OnboardingCardState = {
  show: false,
  activeTab: "Quickstart",
};

export type OnboardingCardProps = Pick<OnboardingCardState, "activeTab">;

function OnboardingCard(props: OnboardingCardProps) {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState<TabTitle>(
    props.activeTab ?? "Best",
  );

  function handleTabClick(tabName) {
    setActiveTab(tabName);
  }

  function handleClose() {
    setLocalStorage("hasDismissedOnboardingCard", true);
    dispatch(setOnboardingCard({ show: false }));
  }

  function renderTabContent() {
    switch (activeTab) {
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
