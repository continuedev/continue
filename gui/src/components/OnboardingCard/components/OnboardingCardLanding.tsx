import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { Button, ButtonSubtext } from "../..";
import { useAuth } from "../../../context/Auth";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { selectCurrentOrg } from "../../../redux";
import { useAppSelector } from "../../../redux/hooks";
import { hasPassedFTL } from "../../../util/freeTrial";
import ContinueLogo from "../../gui/ContinueLogo";
import { ToolTip } from "../../gui/Tooltip";
import { useOnboardingCard } from "../hooks";

export function OnboardingCardLanding({
  onSelectConfigure,
  isDialog,
}: {
  onSelectConfigure: () => void;
  isDialog?: boolean;
}) {
  const ideMessenger = useContext(IdeMessengerContext);
  const onboardingCard = useOnboardingCard();
  const auth = useAuth();
  const currentOrg = useAppSelector(selectCurrentOrg);

  function onGetStarted() {
    void auth.login(true).then((success) => {
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
      ) : (
        <>
          <p className="w-full text-sm">
            Log in to access a free trial of the
            <br />
            <span
              className="cursor-pointer underline hover:brightness-125"
              data-tooltip-id="models-addon-tooltip"
              onClick={() =>
                ideMessenger.post("controlPlane/openUrl", {
                  path: "pricing",
                })
              }
            >
              Models Add-On
            </span>
            <ToolTip id="models-addon-tooltip" place="bottom">
              Free trial includes 50 Chat requests and 2,000 autocomplete
              requests
            </ToolTip>
          </p>

          <Button
            onClick={onGetStarted}
            className="mt-4 grid w-full grid-flow-col items-center gap-2"
          >
            Log in to Continue Hub
          </Button>
        </>
      )}

      <ButtonSubtext onClick={onSelectConfigure}>
        <div className="mt-1 flex cursor-pointer items-center justify-center gap-1 hover:brightness-125">
          <span>Or, configure your own models</span>
          <ChevronRightIcon className="h-3 w-3" />
        </div>
      </ButtonSubtext>
    </div>
  );
}
