import { CreditStatus } from "../../control-plane/client";

/**
 * Determines if a user has exhausted their free trial starter credits.
 * This should ONLY return true for users who:
 * 1. Are using credits-based API keys (free trial or models add-on)
 * 2. Have no credits remaining
 * 3. Have NOT purchased credits (i.e., are still on free trial)
 * 4. Have opted into the free trial
 *
 * Paid users who have exhausted their purchased credits should NOT trigger this.
 */
export function isOutOfStarterCredits(
  usingModelsAddOnApiKey: boolean,
  creditStatus: CreditStatus,
): boolean {
  // Only show onboarding for free trial users who have run out of credits
  // Do NOT show for paid users who have purchased credits, even if they've run out
  return (
    usingModelsAddOnApiKey &&
    creditStatus.optedInToFreeTrial &&
    !creditStatus.hasCredits &&
    !creditStatus.hasPurchasedCredits
  );
}
