import { OnboardingModes } from "core/protocol/core";
import { useAppSelector } from "../../redux/hooks";
import { getLocalStorage, setLocalStorage } from "../../util/localStorage";
import Alert from "../gui/Alert";
import { ReusableCard } from "../ReusableCard";
import { OnboardingCardLanding } from "./components/OnboardingCardLanding";
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
  showFreeTrialExceededAlert?: boolean;
}

export function OnboardingCard({
  isDialog,
  showFreeTrialExceededAlert,
}: OnboardingCardProps) {
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
      case OnboardingModes.MODELS_ADD_ON:
        return <OnboardingModelsAddOnTab />;
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
        {showFreeTrialExceededAlert && (
          <div className="mb-3 mt-4">
            <Alert>
              <h4 className="mb-1 mt-0 text-sm font-semibold">
                Free trial completed
              </h4>
              <span className="text-xs">
                To keep using Continue, select an option below to setup your
                models
              </span>
            </Alert>
          </div>
        )}
        <OnboardingCardTabs
          activeTab={activeTab}
          onTabClick={setActiveTab}
          showFreeTrialExceededAlert
        />
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
