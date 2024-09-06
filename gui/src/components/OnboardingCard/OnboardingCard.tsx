// gui/src/components/OnboardingCard/OnboardingCard.tsx
import { useState } from "react";
import OnboardingCardTabs, { Tabs } from "./OnboardingCardTabs";
import { XMarkIcon } from "@heroicons/react/24/outline";
import OnboardingLocalTab from "./OnboardingLocalTab";
import OnboardingQuickstartTab from "./OnboardingQuickstartTab";
import styled from "styled-components";
import { defaultBorderRadius, lightGray } from "../";
import OnboardingBestTab from "./OnboardingBestTab";

const StyledCard = styled.div`
  margin: auto;
  border-style: solid;
  border-width: 1.5px;
  border-radius: ${defaultBorderRadius};
  border-color: ${lightGray};
  padding: 1rem 1.5rem; // py-4 px-6
  box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.45); // More pronounced shadow
`;

function OnboardingCard() {
  const [activeTab, setActiveTab] = useState(Tabs.Quickstart);
  const [isCardVisible, setIsCardVisible] = useState(true);

  const handleTabClick = (tabName) => {
    setActiveTab(tabName);
  };

  const handleClose = () => {
    localStorage.setItem("dismissCard", "true");
    setIsCardVisible(false);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case Tabs.Quickstart:
        return <OnboardingQuickstartTab />;
      case Tabs.Best:
        return <OnboardingBestTab />;
      case Tabs.Local:
        return <OnboardingLocalTab />;
      default:
        return null;
    }
  };

  if (!isCardVisible) {
    return null;
  }

  return (
    <StyledCard>
      <OnboardingCardTabs activeTab={activeTab} onTabClick={handleTabClick} />
      {/* <button
          className="text-gray-600 border border-transparent hover:border-gray-600 hover:bg-gray-100 rounded p-1 flex items-center justify-center cursor-pointer"
          onClick={handleClose}
        >
          <XMarkIcon className="h-3 w-3" />
        </button> */}
      <div className="content py-4">{renderTabContent()}</div>
    </StyledCard>
  );
}

export default OnboardingCard;
