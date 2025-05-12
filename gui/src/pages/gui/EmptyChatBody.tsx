import { ConversationStarterCards } from "../../components/ConversationStarters";
import { ExploreHubCard } from "../../components/ExploreHubCard";
import { OnboardingCard } from "../../components/OnboardingCard";
import { PlatformOnboardingCard } from "../../components/OnboardingCard/platform/PlatformOnboardingCard";

export interface EmptyChatBodyProps {
  showOnboardingCard?: boolean;
}

export function EmptyChatBody({ showOnboardingCard }: EmptyChatBodyProps) {
  if (showOnboardingCard) {
    return (
      <div className="mx-2 mt-6">
        {true ? (
          // For now we are excluding local onboarding options other than ollama
          <PlatformOnboardingCard isDialog={false} />
        ) : (
          <OnboardingCard isDialog={false} />
        )}
      </div>
    );
  }

  return (
    <div className="mx-2 mt-2">
      <ExploreHubCard />
      <ConversationStarterCards />
    </div>
  );
}
