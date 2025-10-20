import {
  ChevronDownIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { Tool } from "core";
import { useMemo, useState } from "react";
import ToggleSwitch from "../../../components/gui/Switch";
import { ToolTip } from "../../../components/gui/Tooltip";
import { Card } from "../../../components/ui";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { toggleToolGroupSetting } from "../../../redux/slices/uiSlice";
import { ToolPolicyItem } from "./ToolPolicyItem";

interface ToolPoliciesGroupProps {
  showIcon: boolean;
  groupName: string;
  displayName: string;
  allToolsOff: boolean;
  duplicateDetection: Record<string, boolean>;
}

export function ToolPoliciesGroup({
  showIcon,
  groupName,
  displayName,
  allToolsOff,
  duplicateDetection,
}: ToolPoliciesGroupProps) {
  const dispatch = useAppDispatch();
  const [isExpanded, setIsExpanded] = useState(false);

  const availableTools = useAppSelector(
    (state) => state.config.config.tools as Tool[],
  );
  const tools = useMemo(() => {
    return availableTools.filter((t) => t.group === groupName);
  }, [availableTools, groupName]);

  const toolGroupSettings = useAppSelector(
    (state) => state.ui.toolGroupSettings,
  );
  const isGroupEnabled = useMemo(() => {
    return toolGroupSettings[groupName] !== "exclude";
  }, [toolGroupSettings, groupName]);

  return (
    <Card className="flex flex-1 flex-col p-0">
      <div
        className="flex cursor-pointer items-center justify-between gap-3 rounded px-2 py-2 hover:bg-gray-50 hover:bg-opacity-5"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <ChevronDownIcon
            className={`text-description h-3 w-3 transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
          <div className="flex items-center gap-2">
            {showIcon && (
              <WrenchScrewdriverIcon className="h-4 w-4 flex-shrink-0" />
            )}
            <span className="text-sm font-semibold">{displayName}</span>
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-gray-600 px-0.5 text-xs font-medium text-white">
              {tools.length}
            </div>
          </div>
        </div>
        <ToolTip
          content={
            allToolsOff
              ? "Tools disabled in current mode"
              : isGroupEnabled
                ? `Disable all tools in ${groupName} group`
                : `Enable all tools in ${groupName} group`
          }
        >
          <div>
            <ToggleSwitch
              isToggled={isGroupEnabled}
              onToggle={() => dispatch(toggleToolGroupSetting(groupName))}
              text=""
              size={10}
              disabled={allToolsOff}
            />
          </div>
        </ToolTip>
      </div>

      {isExpanded && (
        <div className="mt-3 space-y-1 pl-2">
          {tools.map((tool) => (
            <ToolPolicyItem
              key={tool.uri + tool.function.name}
              tool={tool}
              duplicatesDetected={duplicateDetection[tool.function.name]}
              isGroupEnabled={isGroupEnabled}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
