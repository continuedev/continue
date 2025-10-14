import { CreditStatus } from "../../control-plane/client";

export function isOutOfStarterCredits(
  usingModelsAddOnApiKey: boolean,
  creditStatus: CreditStatus,
): boolean {
  return (
    usingModelsAddOnApiKey &&
    !creditStatus.hasCredits &&
    !creditStatus.hasPurchasedCredits
  );
}
