import { OnboardingModes } from "core/protocol/core";
import { useAppSelector } from "../../redux/hooks";
import { getLocalStorage, setLocalStorage } from "../../util/localStorage";
import { ReusableCard } from "../ReusableCard";
import {
  OnboardingCardLanding,
  OnboardingCardTabs,
  OnboardingLocalTab,
  OnboardingProvidersTab,
} from "./components";
import { useOnboardingCard } from "./hooks";

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

  function renderTabContent() {
    switch (activeTab) {
      case OnboardingModes.API_KEY:
        return <OnboardingProvidersTab />;
      case OnboardingModes.LOCAL:
        return <OnboardingLocalTab />;
      default:
        return <OnboardingProvidersTab />;
    }
  }

  if (activeTab) {
    return (
      <ReusableCard
        showCloseButton={!isDialog && !!config.modelsByRole.chat.length}
        onClose={close}
        testId="onboarding-card"
      >
        <OnboardingCardTabs activeTab={activeTab} onTabClick={setActiveTab} />
        {renderTabContent()}
      </ReusableCard>
    );
  }

  return (
    <ReusableCard
      showCloseButton={!isDialog && !!config.modelsByRole.chat.length}
      onClose={close}
    >
      <div className="flex h-full w-full items-center justify-center">
        <OnboardingCardLanding
          onSelectConfigure={() => setActiveTab(OnboardingModes.API_KEY)}
          isDialog={isDialog}
        />
      </div>
    </ReusableCard>
  );
}
