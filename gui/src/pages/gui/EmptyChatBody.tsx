import { ConversationStarterCards } from "../../components/ConversationStarters";
import { ExploreHubCard } from "../../components/ExploreHubCard";
import { OnboardingCard } from "../../components/OnboardingCard";
import { PlatformOnboardingCard } from "../../components/OnboardingCard/platform/PlatformOnboardingCard";

export interface EmptyChatBodyProps {
  useHub: boolean;
  showOnboardingCard?: boolean;
}

export function EmptyChatBody({
  useHub,
  showOnboardingCard,
}: EmptyChatBodyProps) {
  if (showOnboardingCard) {
    return (
      <div className="mx-2 mt-6">
        {useHub ? (
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
