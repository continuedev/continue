import {
  DefaultApiInterface,
  GetFreeTrialStatus200Response,
} from "@continuedev/sdk/dist/api/dist/index.js";
import { Box, Text } from "ink";
import React, { useEffect, useState } from "react";

interface FreeTrialStatusProps {
  apiClient?: DefaultApiInterface;
}

const FreeTrialStatus: React.FC<FreeTrialStatusProps> = ({ apiClient }) => {
  const [status, setStatus] = useState<GetFreeTrialStatus200Response | null>(
    null
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

  // Don't render anything while loading or if no status
  if (loading || !status || !status.optedInToFreeTrial) {
    return null;
  }

  const chatUsed = status.chatCount ?? 0;
  const chatLimit = status.chatLimit;

  return (
    <Box marginLeft={1} marginBottom={1}>
      <Text color="gray">
        {chatUsed}/{chatLimit} free trial
      </Text>
    </Box>
  );
};

export default FreeTrialStatus;
