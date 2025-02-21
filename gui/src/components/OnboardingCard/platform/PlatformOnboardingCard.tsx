import { XMarkIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import styled from "styled-components";
import { CloseButton, defaultBorderRadius, vscInputBackground } from "../..";
import { getLocalStorage, setLocalStorage } from "../../../util/localStorage";
import Alert from "../../gui/Alert";
import { TabTitle } from "../components/OnboardingCardTabs";
import { useOnboardingCard } from "../hooks";
import OnboardingLocalTab from "../tabs/OnboardingLocalTab";
import MainTab from "./tabs/main";
import { useAppSelector } from "../../../redux/hooks";

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

interface OnboardingCardProps {
  isDialog: boolean;
}

export function PlatformOnboardingCard({ isDialog }: OnboardingCardProps) {
  const onboardingCard = useOnboardingCard();
  const config = useAppSelector((store) => store.config.config);

  if (getLocalStorage("onboardingStatus") === undefined) {
    setLocalStorage("onboardingStatus", "Started");
  }

  const [currentTab, setCurrentTab] = useState<"main" | "local">("main");

  return (
    <StyledCard className="xs:py-4 xs:px-4 relative px-2 py-3">
      {!isDialog && !!config.models.length && (
        <CloseButton onClick={() => onboardingCard.close()}>
          <XMarkIcon className="mt-1.5 hidden h-5 w-5 hover:brightness-125 sm:flex" />
        </CloseButton>
      )}
      <div className="content py-4">
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
                <code>config.yaml</code> file. If you're just looking to use
                Ollama and still want to manage your configuration through
                Continue, click{" "}
                <a href="#" onClick={() => setCurrentTab("main")}>
                  here
                </a>
              </Alert>

              <OnboardingLocalTab isDialog={isDialog} />
            </div>
          )}
        </div>
      </div>
    </StyledCard>
  );
}
