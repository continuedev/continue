import { OnboardingTab } from "./types";
import ContinueLogo from "../../ContinueLogo";
import QuickStartSubmitButton from "../components/QuickStartSubmitButton";

function OnboardingQuickstartTab({ onComplete }: OnboardingTab) {
  return (
    <div className="flex justify-center items-center">
      <div className="flex flex-col items-center justify-center w-3/4 text-center">
        <ContinueLogo height={75} />

        <p className="text-sm">
          Quickly get up and running using our API keys. After this trial, we'll
          help you set up your own models.
        </p>

        <p className="text-sm">
          To prevent abuse, we'll ask you to sign in to GitHub.
        </p>

        <QuickStartSubmitButton onComplete={onComplete} />
      </div>
    </div>
  );
}

export default OnboardingQuickstartTab;
