import { CreditStatus } from "../../control-plane/client";

export function isOutOfStarterCredits(
  usingFreeTrialApiKey: boolean,
  creditStatus: CreditStatus,
): boolean {
  return (
    usingFreeTrialApiKey &&
    !creditStatus.hasCredits &&
    !creditStatus.hasPurchasedCredits
  );
}
