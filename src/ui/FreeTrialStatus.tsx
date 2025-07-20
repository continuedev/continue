import {
  DefaultApiInterface,
  GetFreeTrialStatus200Response,
} from "@continuedev/sdk/dist/api/dist/index.js";
import { Text } from "ink";
import React, { useEffect, useState } from "react";
import FreeTrialTransitionUI from "./FreeTrialTransitionUI.js";

interface FreeTrialStatusProps {
  apiClient?: DefaultApiInterface;
  onTransitionComplete?: () => void;
  onTransitionStateChange?: (isShowingTransition: boolean) => void;
  onSwitchToLocalConfig?: () => void;
  onFullReload?: () => void;
}

const FreeTrialStatus: React.FC<FreeTrialStatusProps> = ({
  apiClient,
  onTransitionComplete,
  onTransitionStateChange,
  onSwitchToLocalConfig,
  onFullReload,
}) => {
  const [status, setStatus] = useState<GetFreeTrialStatus200Response | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [showTransition, setShowTransition] = useState(false);

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
    } catch (error) {
      // Silently handle errors - component returns null if no status
      setStatus(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchStatus();

    // Poll every 5 seconds
    const interval = setInterval(fetchStatus, 5000);

    return () => clearInterval(interval);
  }, []);

  // Check if user has maxed out their free trial
  useEffect(() => {
    if (!status || !status.optedInToFreeTrial || loading) {
      return;
    }

    const chatUsed = status.chatCount ?? 0;
    const chatLimit = status.chatLimit;

    // Check if user has maxed out their free trial
    if (true) {
      // if (chatUsed >= chatLimit) {
      setShowTransition(true);
    }
  }, [status, loading]);

  // Notify parent when transition state changes
  useEffect(() => {
    if (onTransitionStateChange) {
      onTransitionStateChange(showTransition);
    }
  }, [showTransition, onTransitionStateChange]);

  const handleTransitionComplete = () => {
    setShowTransition(false);
    // Optionally refetch status to check if they now have access
    fetchStatus();
    if (onTransitionComplete) {
      onTransitionComplete();
    }
  };

  const handleSwitchToLocalConfig = () => {
    setShowTransition(false);
    if (onSwitchToLocalConfig) {
      onSwitchToLocalConfig();
    }
  };

  const handleFullReload = () => {
    setShowTransition(false);
    if (onFullReload) {
      onFullReload();
    }
  };

  // Show transition UI if free trial is maxed out
  if (showTransition) {
    return (
      <FreeTrialTransitionUI
        onComplete={handleTransitionComplete}
        onSwitchToLocalConfig={handleSwitchToLocalConfig}
        onFullReload={handleFullReload}
      />
    );
  }

  // Don't render anything while loading or if no status
  if (loading || !status || !status.optedInToFreeTrial) {
    return null;
  }

  const chatUsed = status.chatCount ?? 0;
  const chatLimit = status.chatLimit;

  // Show normal status for active free trial
  return (
    <Text color="gray">
      {chatUsed}/{chatLimit} free trial
    </Text>
  );
};

export default FreeTrialStatus;
