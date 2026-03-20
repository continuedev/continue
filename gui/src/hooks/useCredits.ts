import { CreditStatus } from "core/control-plane/client";
import { useCallback, useContext, useEffect, useState } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";

export function useCreditStatus() {
  const ideMessenger = useContext(IdeMessengerContext);
  const [creditStatus, setCreditStatus] = useState<CreditStatus | null>(null);

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

  // One-time fetch on mount — no polling
  useEffect(() => {
    void refreshCreditStatus();
  }, [refreshCreditStatus]);

  return {
    creditStatus,
    refreshCreditStatus,
  };
}
