import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { Tool } from "core";
import { useMemo } from "react";
import { useAppDispatch, useAppSelector } from "../../../../../redux/hooks";
import { toggleToolGroupSetting } from "../../../../../redux/slices/uiSlice";
import { fontSize } from "../../../../../util";
import ToggleSwitch from "../../../../gui/Switch";
import ToolPolicyItem from "./ToolPolicyItem";

interface ModeBadgeProps {
  text: string;
  icon: React.ReactNode;
  onClick: () => void;
  isSelected: boolean;
}
const ModeBadge = ({ text, onClick, isSelected, icon }: ModeBadgeProps) => {
  return (
    <div
      className="flex flex-1 items-center justify-center gap-1.5 text-sm"
      onClick={isSelected ? undefined : onClick}
    >
      {icon}
      {text}
    </div>
  );
};

export const ToolPoliciesSection = () => {
  const mode = useAppSelector((state) => state.session.mode);
  const readOnlyMode = useAppSelector((state) => state.session.readOnlyMode);
  const availableTools = useAppSelector((state) => state.config.config.tools);
  const toolGroupSettings = useAppSelector(
    (store) => store.ui.toolGroupSettings,
  );
  const dispatch = useAppDispatch();

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

  const pseudoMode = mode === "chat" ? "chat" : readOnlyMode ? "plan" : "act";
  const message =
    pseudoMode === "chat"
      ? "All tools are disabled in Chat mode"
      : pseudoMode === "plan"
        ? "Plan mode: only MCP and read-only tools"
        : "Act mode: all tool policies apply";

  return (
    <>
      <div className="mb-3 px-1">
        <InformationCircleIcon className="text-description-muted mr-1.5 inline-block h-2.5 w-2.5 flex-shrink-0" />
        <span className="text-description text-xs italic">{message}</span>
      </div>
      {toolsByGroup.map(([groupName, tools]) => {
        const isGroupEnabled =
          !allToolsOff && toolGroupSettings[groupName] !== "exclude";
        return (
          <div key={groupName} className="mt-2 flex flex-col pr-1">
            <div className="flex flex-row items-center justify-between px-1">
              <h3
                className="m-0 p-0 font-bold"
                style={{
                  fontSize: fontSize(-2),
                }}
              >
                {groupName}
              </h3>
              <ToggleSwitch
                isToggled={isGroupEnabled}
                onToggle={() => dispatch(toggleToolGroupSetting(groupName))}
                text=""
                size={10}
                disabled={allToolsOff}
              />
            </div>
            <div className={`relative flex flex-col p-1`}>
              {tools.map((tool) => (
                <ToolPolicyItem
                  key={tool.uri + tool.function.name}
                  tool={tool}
                  duplicatesDetected={duplicateDetection[tool.function.name]}
                  isGroupEnabled={isGroupEnabled}
                />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
};
