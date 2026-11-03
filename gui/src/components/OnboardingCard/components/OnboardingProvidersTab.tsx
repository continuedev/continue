import { OnboardingModes } from "core/protocol/core";
import { ProviderSetupFlow } from "../../ProviderSetup/ProviderSetupFlow";
import { useSubmitOnboarding } from "../hooks/useSubmitOnboarding";

interface OnboardingProvidersTabProps {
  /** Whether this is being shown in a dialog context */
  isDialog?: boolean;
}

/**
 * The API key tab: the shared provider setup flow (credentials, model
 * checklist, review) instead of a fixed list of models per provider.
 */
export function OnboardingProvidersTab({
  isDialog,
}: OnboardingProvidersTabProps) {
  const { finishOnboarding } = useSubmitOnboarding(
    OnboardingModes.API_KEY,
    isDialog,
  );

  return (
    <div className="flex h-full w-full items-center justify-center">
      <ProviderSetupFlow
        initialProvider="anthropic"
        onDone={finishOnboarding}
      />
    </div>
  );
}
