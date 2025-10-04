import { Text } from "ink";
import React from "react";

import { useServices } from "src/hooks/useService.js";
import { ToolPermissionServiceState } from "src/services/ToolPermissionService.js";
import { SERVICE_NAMES } from "src/services/types.js";

import type { PermissionMode } from "../../permissions/types.js";

interface ModeIndicatorProps {
  mode?: PermissionMode;
}

const ModeIndicator: React.FC<ModeIndicatorProps> = ({ mode }) => {
  const { services } = useServices<{
    toolPermissions: ToolPermissionServiceState;
  }>([SERVICE_NAMES.TOOL_PERMISSIONS]);
  const currentMode = mode ?? services.toolPermissions?.currentMode ?? "normal";

  // Don't show indicator for normal mode to keep it clean
  if (currentMode === "normal") {
    return null;
  }

  // Get mode display info
  const getModeDisplay = (mode: PermissionMode) => {
    switch (mode) {
      case "plan":
        return { text: "⏸ plan", color: "blue" };
      case "auto":
        return { text: "⏵⏵ auto", color: "green" };
      default:
        return { text: mode, color: "dim" };
    }
  };

  const { text, color } = getModeDisplay(currentMode);

  return (
    <Text color={color} dimColor={false}>
      [{text}]
    </Text>
  );
};

export { ModeIndicator };
