import BestExperienceConfigForm from "../components/BestExperienceConfigForm";
import AlternativeProviderAlert from "../components/AlternativeProviderAlert";
import { OnboardingTab } from "./types";

function OnboardingBestTab({ onComplete }: OnboardingTab) {
  return (
    <div className="flex flex-col gap-4">
      <AlternativeProviderAlert onComplete={onComplete} />
      <BestExperienceConfigForm onComplete={onComplete} />
    </div>
  );
}

export default OnboardingBestTab;
