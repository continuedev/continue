import { useState } from "react";
import { useAppSelector } from "../../../redux/hooks";
import { getLocalStorage, setLocalStorage } from "../../../util/localStorage";
import Alert from "../../gui/Alert";
import { ReusableCard } from "../../ReusableCard";
import { TabTitle } from "../components/OnboardingCardTabs";
import { useOnboardingCard } from "../hooks";
import OnboardingLocalTab from "../tabs/OnboardingLocalTab";
import MainTab from "./tabs/main";

export interface OnboardingCardState {
  show?: boolean;
  activeTab?: TabTitle;
}

interface OnboardingCardProps {
  isDialog: boolean;
}

export function PlatformOnboardingCard({ isDialog }: OnboardingCardProps) {
  const onboardingCard = useOnboardingCard();
  const config = useAppSelector((store) => store.config.config);
  const [currentTab, setCurrentTab] = useState<"main" | "local">("main");

  if (getLocalStorage("onboardingStatus") === undefined) {
    setLocalStorage("onboardingStatus", "Started");
  }

  return (
    <ReusableCard
      showCloseButton={!isDialog && !!config.modelsByRole.chat.length}
      onClose={() => onboardingCard.close()}
    >
      <div className="flex h-full w-full items-center justify-center">
        {currentTab === "main" ? (
          <MainTab
            onRemainLocal={() => setCurrentTab("local")}
            isDialog={isDialog}
          />
        ) : (
          <div className="mt-4 flex flex-col">
            <Alert type="info">
              By choosing this option, Continue will be configured by a local{" "}
              <code className="text-vsc-background">config.yaml</code> file. If
              you're just looking to use Ollama and still want to manage your
              configuration through Continue, click{" "}
              <a href="#" onClick={() => setCurrentTab("main")}>
                here
              </a>
            </Alert>
            <OnboardingLocalTab isDialog={isDialog} />
          </div>
        )}
      </div>
    </ReusableCard>
  );
}
