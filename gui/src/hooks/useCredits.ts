import { usesCreditsBasedApiKey } from "core/config/usesFreeTrialApiKey";
import { CreditStatus } from "core/control-plane/client";
import { isOutOfStarterCredits } from "core/llm/utils/starterCredits";
import { useCallback, useContext, useEffect, useState } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { useAppSelector } from "../redux/hooks";
import { getLocalStorage } from "../util/localStorage";

export function useCreditStatus() {
  const config = useAppSelector((state) => state.config.config);
  const ideMessenger = useContext(IdeMessengerContext);
  const [creditStatus, setCreditStatus] = useState<CreditStatus | null>(null);

  const hasExitedFreeTrial = getLocalStorage("hasExitedFreeTrial");
  const usingCreditsBasedApiKey = usesCreditsBasedApiKey(config);
  const isUsingFreeTrial = usingCreditsBasedApiKey && !hasExitedFreeTrial;
  const outOfStarterCredits = creditStatus
    ? isOutOfStarterCredits(usingCreditsBasedApiKey, creditStatus)
    : false;

  const refreshCreditStatus = useCallback(async () => {
    try {
      const resp = await ideMessenger.request(
        "controlPlane/getCreditStatus",
        undefined,
      );
      if (resp.status === "success") {
        setCreditStatus(resp.content);
      }
    } catch (error) {
      console.error("Failed to refresh credit status", error);
    }
  }, [ideMessenger]);

  useEffect(() => {
    void refreshCreditStatus();

    let intervalId: NodeJS.Timeout | null = null;

    if (isUsingFreeTrial) {
      intervalId = setInterval(() => {
        void refreshCreditStatus();
      }, 15000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isUsingFreeTrial, refreshCreditStatus]);

  return {
    creditStatus,
    outOfStarterCredits,
    isUsingFreeTrial,
    refreshCreditStatus,
  };
}
