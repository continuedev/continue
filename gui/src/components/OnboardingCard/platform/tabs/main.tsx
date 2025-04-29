import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { Button, ButtonSubtext } from "../../..";
import { useAuth } from "../../../../context/Auth";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { selectCurrentOrg } from "../../../../redux";
import { useAppSelector } from "../../../../redux/hooks";
import { hasPassedFTL } from "../../../../util/freeTrial";
import ContinueLogo from "../../../gui/ContinueLogo";
import { useOnboardingCard } from "../../hooks";

export default function MainTab({
  onRemainLocal,
  isDialog,
}: {
  onRemainLocal: () => void;
  isDialog: boolean;
}) {
  const ideMessenger = useContext(IdeMessengerContext);
  const onboardingCard = useOnboardingCard();
  const auth = useAuth();
  const currentOrg = useAppSelector(selectCurrentOrg);

  function onGetStarted() {
    auth.login(true).then((success) => {
      if (success) {
        onboardingCard.close(isDialog);
      }
    });
  }

  function openPastFreeTrialOnboarding() {
    ideMessenger.post("controlPlane/openUrl", {
      path: "setup-models",
      orgSlug: currentOrg?.slug,
    });
    onboardingCard.close(isDialog);
  }

  const pastFreeTrialLimit = hasPassedFTL();

  return (
    <div className="xs:px-0 flex w-full max-w-full flex-col items-center justify-center px-4 text-center">
      <div className="xs:flex hidden">
        <ContinueLogo height={75} />
      </div>

      {pastFreeTrialLimit ? (
        <>
          <p className="xs:w-3/4 w-full text-sm">
            You've reached the free trial limit. Visit the Continue Platform to
            select a Coding Assistant.
          </p>
          <Button
            onClick={openPastFreeTrialOnboarding}
            className="mt-4 grid w-full grid-flow-col items-center gap-2"
          >
            Go to Continue Platform
          </Button>
        </>
      ) : onboardingCard.activeTab === "ExistingUserHubIntro" ? (
        <>
          <p className="xs:w-3/4 w-full text-sm">
            You can now browse and create custom AI code assistants at{" "}
            <code>hub.continue.dev</code>
          </p>

          <Button
            onClick={onGetStarted}
            className="mt-4 grid w-full grid-flow-col items-center gap-2"
          >
            Get started
          </Button>
        </>
      ) : (
        <>
          <p className="xs:w-3/4 w-full text-sm">
            Log in to quickly build your first custom AI code assistant
          </p>

          <Button
            onClick={onGetStarted}
            className="mt-4 grid w-full grid-flow-col items-center gap-2"
          >
            Get started
          </Button>
        </>
      )}

      {onboardingCard.activeTab === "ExistingUserHubIntro" ? (
        <ButtonSubtext onClick={() => onboardingCard.close(isDialog)}>
          <div className="mt-4 flex cursor-pointer items-center justify-center gap-1">
            <span>Or, use Continue as usual</span>
            <ChevronRightIcon className="h-3 w-3" />
          </div>
        </ButtonSubtext>
      ) : (
        <ButtonSubtext onClick={onRemainLocal}>
          <div className="flex cursor-pointer items-center justify-center gap-1 hover:brightness-125">
            <span>Or, remain local</span>
            <ChevronRightIcon className="h-3 w-3" />
          </div>
        </ButtonSubtext>
      )}
    </div>
  );
}
