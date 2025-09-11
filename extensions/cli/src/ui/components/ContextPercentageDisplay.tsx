import { Text } from "ink";
import React from "react";

interface ContextPercentageDisplayProps {
  percentage: number;
}

/**
 * Component to display the current context usage percentage
 * Shows the percentage in gray color for consistency with other status indicators
 * Only displays when percentage exceeds 75% threshold
 */
export const ContextPercentageDisplay: React.FC<
  ContextPercentageDisplayProps
> = ({ percentage }) => {
  // Only show if percentage is greater than 75%
  if (percentage <= 75) {
    return null;
  }

  return <Text color="dim">Context: {percentage}%</Text>;
};
