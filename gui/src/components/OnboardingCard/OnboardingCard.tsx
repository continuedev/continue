import { useAppSelector } from "../../redux/hooks";
import { getLocalStorage, setLocalStorage } from "../../util/localStorage";
import { ReusableCard } from "../ReusableCard";
import { OnboardingCardTabs, TabTitle } from "./components/OnboardingCardTabs";
import { useOnboardingCard } from "./hooks/useOnboardingCard";
import * as Tabs from "./tabs";

export interface OnboardingCardState {
  show?: boolean;
  activeTab?: TabTitle;
}

interface OnboardingCardProps {
  isDialog?: boolean;
}

export function OnboardingCard({ isDialog }: OnboardingCardProps) {
  const onboardingCard = useOnboardingCard();
  const config = useAppSelector((store) => store.config.config);

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
    <ReusableCard
      showCloseButton={!isDialog && !!config.modelsByRole.chat.length}
      onClose={() => onboardingCard.close()}
      testId="onboarding-card"
    >
      <OnboardingCardTabs
        activeTab={onboardingCard.activeTab || "Best"}
        onTabClick={onboardingCard.setActiveTab}
      />
      {renderTabContent()}
    </ReusableCard>
  );
}
