import { OnboardingModes } from "core/protocol/core";
import { useAppSelector } from "../../redux/hooks";
import { getLocalStorage, setLocalStorage } from "../../util/localStorage";
import { ReusableCard } from "../ReusableCard";
import {
  OnboardingApiKeyTab,
  OnboardingCardLanding,
  OnboardingCardTabs,
  OnboardingOllamaTab,
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
      case OnboardingModes.API_KEYS:
        return <OnboardingApiKeyTab />;
      case OnboardingModes.OLLAMA:
        return <OnboardingOllamaTab />;
      default:
        return <OnboardingApiKeyTab />;
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
          onSelectConfigure={() => setActiveTab(OnboardingModes.API_KEYS)}
          isDialog={isDialog}
        />
      </div>
    </ReusableCard>
  );
}
