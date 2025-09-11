import { Text } from "ink";
import React, { useEffect, useState } from "react";

import type { PermissionMode } from "../../permissions/types.js";
import { modeService } from "../../services/ModeService.js";

interface ModeIndicatorProps {
  mode?: PermissionMode;
}

const ModeIndicator: React.FC<ModeIndicatorProps> = ({ mode }) => {
  const [currentMode, setCurrentMode] = useState<PermissionMode>(
    mode || modeService.getCurrentMode(),
  );

  // Update mode when it changes (for cases where mode prop is not provided)
  useEffect(() => {
    if (!mode) {
      // Listen for immediate mode changes
      const handleModeChange = (newMode: PermissionMode) => {
        setCurrentMode(newMode);
      };

      modeService.on("modeChanged", handleModeChange);

      // Set initial mode
      setCurrentMode(modeService.getCurrentMode());

      return () => {
        modeService.off("modeChanged", handleModeChange);
      };
    } else if (mode !== currentMode) {
      setCurrentMode(mode);
    }
  }, [mode]);

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
