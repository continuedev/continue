import { MessageModes, Tool } from "core";
import { useMemo, useState } from "react";
import { useAppSelector } from "../../../redux/hooks";

export function useToolPolicies() {
  const mode = useAppSelector((state) => state.session.mode);
  const availableTools = useAppSelector((state) => state.config.config.tools);
  const toolGroupSettings = useAppSelector(
    (store) => store.ui.toolGroupSettings,
  );
  const [expandedGroups, setExpandedGroups] = useState<{
    [key: string]: boolean;
  }>({});

  const toolsByGroup = useMemo(() => {
    const byGroup: Record<string, Tool[]> = {};
    for (const tool of availableTools) {
      if (!byGroup[tool.group]) {
        byGroup[tool.group] = [];
      }
      byGroup[tool.group].push(tool);
    }
    return Object.entries(byGroup);
  }, [availableTools]);

  // Detect duplicate tool names
  const duplicateDetection = useMemo(() => {
    const counts: Record<string, number> = {};
    availableTools.forEach((tool) => {
      if (counts[tool.function.name]) {
        counts[tool.function.name] = counts[tool.function.name] + 1;
      } else {
        counts[tool.function.name] = 1;
      }
    });
    return Object.fromEntries(
      Object.entries(counts).map(([k, v]) => [k, v > 1]),
    );
  }, [availableTools]);

  const allToolsOff = mode === "chat";

  const getMessage = (mode: MessageModes) => {
    switch (mode) {
      case "chat":
        return "All tools disabled in Chat, switch to Plan or Agent mode to use tools";
      case "plan":
        return "Read-only/MCP tools available in Plan mode";
      default:
        return "";
    }
  };

  const message = getMessage(mode);

  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  return {
    mode,
    availableTools,
    toolGroupSettings,
    toolsByGroup,
    duplicateDetection,
    allToolsOff,
    message,
    expandedGroups,
    toggleGroup,
  };
}
