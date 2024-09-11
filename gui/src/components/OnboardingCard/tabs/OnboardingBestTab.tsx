import BestExperienceConfigForm from "../components/BestExperienceConfigForm";
import ProviderAlert from "../components/ProviderAlert";
import { useCompleteOnboarding } from "../utils";

function OnboardingBestTab() {
  const { completeOnboarding } = useCompleteOnboarding();

  return (
    <div className="flex flex-col gap-4">
      <ProviderAlert />
      <BestExperienceConfigForm onComplete={completeOnboarding} />
    </div>
  );
}

export default OnboardingBestTab;
