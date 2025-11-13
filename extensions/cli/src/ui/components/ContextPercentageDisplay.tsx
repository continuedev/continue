import { Text } from "ink";
import React from "react";

interface ContextPercentageDisplayProps {
  percentage: number;
}

/**
 * Component to display the current context usage percentage
 * Shows the non-zero percentage in gray color for consistency with other status indicators
 */
export const ContextPercentageDisplay: React.FC<
  ContextPercentageDisplayProps
> = ({ percentage }) => {
  if (percentage === 0) {
    return null;
  }

  return <Text color="dim">Context: {percentage}%</Text>;
};
