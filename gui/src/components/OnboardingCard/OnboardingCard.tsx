import { OnboardingModes } from "core/protocol/core";
import { useEffect } from "react";
import { useAppSelector } from "../../redux/hooks";
import { getLocalStorage, setLocalStorage } from "../../util/localStorage";
import { ReusableCard } from "../ReusableCard";
import { OnboardingCardTabs } from "./components/OnboardingCardTabs";
import { OnboardingLocalTab } from "./components/OnboardingLocalTab";
import { OnboardingModelsAddOnTab } from "./components/OnboardingModelsAddOnTab";
import { OnboardingProvidersTab } from "./components/OnboardingProvidersTab";
import { useOnboardingCard } from "./hooks/useOnboardingCard";

export interface OnboardingCardState {
  show?: boolean;
  activeTab?: OnboardingModes;
}

interface OnboardingCardProps {
  isDialog?: boolean;
}

export function OnboardingCard({ isDialog }: OnboardingCardProps) {
  const { activeTab, close, setActiveTab } = useOnboardingCard();
  const config = useAppSelector((store) => store.config.config);

  if (getLocalStorage("onboardingStatus") === undefined) {
    setLocalStorage("onboardingStatus", "Started");
  }

  // Default to MODELS_ADD_ON tab if no active tab is set
  useEffect(() => {
    if (!activeTab) {
      setActiveTab(OnboardingModes.MODELS_ADD_ON);
    }
  }, [activeTab, setActiveTab]);

  function renderTabContent() {
    switch (activeTab) {
      case OnboardingModes.API_KEY:
        return <OnboardingProvidersTab />;
      case OnboardingModes.LOCAL:
        return <OnboardingLocalTab />;
      case OnboardingModes.MODELS_ADD_ON:
        return <OnboardingModelsAddOnTab />;
      default:
        return <OnboardingModelsAddOnTab />;
    }
  }

  // Always show tabs view, defaulting to Models Add-On
  const currentTab = activeTab || OnboardingModes.MODELS_ADD_ON;

  return (
    <ReusableCard
      showCloseButton={!isDialog && !!config.modelsByRole.chat.length}
      onClose={close}
      testId="onboarding-card"
    >
      <OnboardingCardTabs activeTab={currentTab} onTabClick={setActiveTab} />
      {renderTabContent()}
    </ReusableCard>
  );
}
