import { ConversationStarterCards } from "../../components/ConversationStarters/ConversationStarterCards";
import { ExploreHubCard } from "../../components/ExploreHubCard";
import { OnboardingCard } from "../../components/OnboardingCard/OnboardingCard";

export interface EmptyChatBodyProps {
  showOnboardingCard?: boolean;
}

export function EmptyChatBody({ showOnboardingCard }: EmptyChatBodyProps) {
  if (showOnboardingCard) {
    return (
      <div className="mx-2 mt-6">
        <OnboardingCard />
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
