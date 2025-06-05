import { OnboardingModes } from "core/protocol/core";
import { useContext } from "react";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { AddModelForm } from "../../../forms";
import { useSubmitOnboarding } from "../hooks/useSubmitOnboarding";

interface OnboardingApiKeyTabProps {
  isDialog?: boolean;
}

export function OnboardingApiKeyTab({ isDialog }: OnboardingApiKeyTabProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const { submitOnboarding } = useSubmitOnboarding(
    OnboardingModes.API_KEYS,
    isDialog,
  );

  const handleSubmit = (models: any[]) => {
    // Send the models to core for configuration
    ideMessenger.post("completeOnboarding", {
      mode: OnboardingModes.API_KEYS,
      models,
    });

    // Complete the onboarding flow
    submitOnboarding();
  };

  return (
    <div className="flex h-full w-full items-center justify-center">
      <AddModelForm onSubmit={handleSubmit} hideFreeTrialLimitMessage={true} />
    </div>
  );
}
