import { Text } from "ink";
import React, { useEffect, useState } from "react";

import { useServices } from "src/hooks/useService.js";
import { ToolPermissionServiceState } from "src/services/ToolPermissionService.js";
import { SERVICE_NAMES } from "src/services/types.js";

import { isLoopEntry, onModeEntryChange } from "../../loop/loopSession.js";
import type { PermissionMode } from "../../permissions/types.js";

interface ModeIndicatorProps {
  mode?: PermissionMode | "loop";
}

/** Whether the person chose the loop entry, re-rendering when it changes. */
function useLoopEntry(): boolean {
  const [on, setOn] = useState(isLoopEntry);
  useEffect(() => onModeEntryChange(() => setOn(isLoopEntry())), []);
  return on;
}

const ModeIndicator: React.FC<ModeIndicatorProps> = ({ mode }) => {
  const { services } = useServices<{
    toolPermissions: ToolPermissionServiceState;
  }>([SERVICE_NAMES.TOOL_PERMISSIONS]);
  const loopEntry = useLoopEntry();
  // The loop entry is plan mode underneath (items run in the working mode),
  // so it is shown whatever the permission mode is
  const currentMode =
    mode ??
    (loopEntry ? "loop" : (services.toolPermissions?.currentMode ?? "normal"));

  // Don't show indicator for normal mode to keep it clean
  if (currentMode === "normal") {
    return null;
  }

  // Get mode display info
  const getModeDisplay = (mode: PermissionMode | "loop") => {
    switch (mode) {
      case "plan":
        return { text: "⏸ plan", color: "blue" };
      case "loop":
        return { text: "⟳ loop", color: "magenta" };
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
