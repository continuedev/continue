import { Box, Text } from "ink";
import React from "react";

import { LoadingAnimation } from "../LoadingAnimation.js";
import { Timer } from "../Timer.js";

interface ActionStatusProps {
  visible: boolean;
  startTime: number;
  message: string;
  showSpinner?: boolean;
  color?: string;
  loadingColor?: string;
}

const ActionStatus: React.FC<ActionStatusProps> = ({
  visible,
  startTime,
  message,
  showSpinner = false,
  color = "gray",
  loadingColor = "green",
}) => {
  if (!visible) return null;

  return (
    <Box paddingX={1} flexDirection="row" gap={1}>
      {showSpinner && <LoadingAnimation color={loadingColor} visible={true} />}
      <Text color={color}>{message}</Text>
      <Text color="gray">(</Text>
      <Timer startTime={startTime} />
      <Text color="gray">• esc to interrupt )</Text>
    </Box>
  );
};

export { ActionStatus };
