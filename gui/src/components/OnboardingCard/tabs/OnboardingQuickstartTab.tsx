import ContinueLogo from "../../gui/ContinueLogo";
import QuickStartSubmitButton from "../components/QuickStartSubmitButton";

interface OnboardingQuickstartTabProps {
  isDialog?: boolean;
}

function OnboardingQuickstartTab({ isDialog }: OnboardingQuickstartTabProps) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="xs:px-0 flex w-full max-w-full flex-col items-center justify-center px-4 text-center">
        <div className="xs:flex hidden">
          <ContinueLogo height={75} />
        </div>

        <p className="xs:w-3/4 w-full text-sm">
          Quickly get up and running using our API keys. After this trial, we'll
          help you set up your own models.
        </p>

        <p className="xs:w-3/4 w-full text-sm">
          To prevent abuse, we'll ask you to sign in to GitHub.
        </p>

        <QuickStartSubmitButton isDialog={isDialog} />
      </div>
    </div>
  );
}

export default OnboardingQuickstartTab;
