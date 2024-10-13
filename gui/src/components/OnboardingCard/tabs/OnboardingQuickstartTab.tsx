import ContinueLogo from "../../ContinueLogo";
import QuickStartSubmitButton from "../components/QuickStartSubmitButton";

function OnboardingQuickstartTab() {
  return (
    <div className="flex justify-center items-center w-full h-full">
      <div className="flex flex-col items-center justify-center w-full max-w-full px-4 xs:px-0 text-center">
        <div className="hidden xs:flex">
          <ContinueLogo height={75} />
        </div>

        <p className="text-sm w-full xs:w-3/4">
          Quickly get up and running using our API keys. After this trial, we'll
          help you set up your own models.
        </p>

        <p className="text-sm w-full xs:w-3/4">
          To prevent abuse, we'll ask you to sign in to GitHub.
        </p>

        <QuickStartSubmitButton />
      </div>
    </div>
  );
}

export default OnboardingQuickstartTab;
