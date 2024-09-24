import BestExperienceConfigForm from "../components/BestExperienceConfigForm";
import ProviderAlert from "../components/ProviderAlert";
import { useSubmitOnboarding } from "../hooks";

function OnboardingBestTab() {
  const { submitOnboarding } = useSubmitOnboarding("Best");

  return (
    <div className="flex flex-col gap-8">
      <div className="hidden xs:flex w-full">
        <ProviderAlert />
      </div>
      <BestExperienceConfigForm onComplete={submitOnboarding} />
    </div>
  );
}

export default OnboardingBestTab;
