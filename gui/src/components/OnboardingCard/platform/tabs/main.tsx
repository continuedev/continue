import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { Button, ButtonSubtext } from "../../..";
import { useAuth } from "../../../../context/Auth";
import ContinueLogo from "../../../gui/ContinueLogo";
import { useOnboardingCard } from "../../hooks";

export default function MainTab({
  onRemainLocal,
}: {
  onRemainLocal: () => void;
}) {
  const onboardingCard = useOnboardingCard();
  const auth = useAuth();

  function onGetStarted() {
    auth.login(true).then((success) => {
      if (success) {
        onboardingCard.close();
      }
    });
  }

  return (
    <div className="xs:px-0 flex w-full max-w-full flex-col items-center justify-center px-4 text-center">
      <div className="xs:flex hidden">
        <ContinueLogo height={75} />
      </div>

      <p className="xs:w-3/4 w-full text-sm">
        Log in to quickly build your first custom AI code assistant
      </p>

      <div className="mt-4 w-full">
        <Button
          onClick={onGetStarted}
          className="grid w-full grid-flow-col items-center gap-2"
        >
          Get started
        </Button>
        <ButtonSubtext onClick={onRemainLocal}>
          <div className="mt-4 flex cursor-pointer items-center justify-center gap-1">
            <span>Or, remain local</span>
            <ChevronRightIcon className="h-3 w-3" />
          </div>
        </ButtonSubtext>
      </div>
    </div>
  );
}
