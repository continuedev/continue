import { ModelConfig } from "@continuedev/config-yaml";
import {
  DefaultApiInterface,
  GetFreeTrialStatus200Response,
} from "@continuedev/sdk/dist/api/dist/index.js";
import { Text } from "ink";
import React, { useEffect, useState } from "react";

export function isModelUsingFreeTrial(model: ModelConfig): boolean {
  return (
    model.provider === "continue-proxy" &&
    (model as any).apiKeyLocation.startsWith("free_trial:")
  );
}

interface FreeTrialStatusProps {
  apiClient?: DefaultApiInterface;
  onTransitionStateChange?: (isShowingTransition: boolean) => void;
  model: ModelConfig;
}

const FreeTrialStatus: React.FC<FreeTrialStatusProps> = ({
  apiClient,
  onTransitionStateChange,
  model,
}) => {
  const [status, setStatus] = useState<GetFreeTrialStatus200Response | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      if (!apiClient) {
        setStatus(null);
        setLoading(false);
        return;
      }

      const response = await apiClient.getFreeTrialStatus();
      setStatus(response);
      setLoading(false);
    } catch {
      // Silently handle errors - component returns null if no status
      setStatus(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchStatus();

    // Don't poll in test environment
    if (process.env.NODE_ENV === "test") {
      return;
    }

    // Poll every 5 seconds
    const interval = setInterval(fetchStatus, 5000);

    return () => clearInterval(interval);
  }, []);

  // Check if user has maxed out their free trial and notify parent
  useEffect(() => {
    if (!status || !status.optedInToFreeTrial || loading) {
      // No transition needed
      if (onTransitionStateChange) {
        onTransitionStateChange(false);
      }
      return;
    }

    const chatUsed = status.chatCount ?? 0;
    const chatLimit = status.chatLimit;

    // Check if user has maxed out their free trial
    const shouldShowTransition =
      chatUsed >= chatLimit && isModelUsingFreeTrial(model);

    if (onTransitionStateChange) {
      onTransitionStateChange(shouldShowTransition);
    }
  }, [status, loading, onTransitionStateChange, model]);

  // Don't render anything while loading or if no status
  if (
    loading ||
    !status ||
    !status.optedInToFreeTrial ||
    !isModelUsingFreeTrial(model)
  ) {
    return null;
  }

  const chatUsed = status.chatCount ?? 0;
  const chatLimit = status.chatLimit;

  // Only show the normal status text - transition UI is handled by parent
  return (
    <Text color="dim">
      {chatUsed}/{chatLimit} free trial
    </Text>
  );
};

export { FreeTrialStatus };
