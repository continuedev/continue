import BestExperienceConfigForm from "../components/BestExperienceConfigForm";
import ProviderAlert from "../components/ProviderAlert";
import { useSubmitOnboarding } from "../hooks";

interface OnboardingBestTabProps {
  isDialog?: boolean;
}

function OnboardingBestTab({ isDialog }: OnboardingBestTabProps) {
  const { submitOnboarding } = useSubmitOnboarding("Best", isDialog);

  return (
    <div className="flex flex-col gap-8">
      <div className="xs:flex hidden w-full">
        <ProviderAlert />
      </div>
      <BestExperienceConfigForm onComplete={submitOnboarding} />
    </div>
  );
}

export default OnboardingBestTab;
