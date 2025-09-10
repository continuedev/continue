import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { Tool } from "core";
import ToggleSwitch from "../../../components/gui/Switch";
import { ToolTip } from "../../../components/gui/Tooltip";
import { Card } from "../../../components/ui";
import { useAppDispatch } from "../../../redux/hooks";
import { toggleToolGroupSetting } from "../../../redux/slices/uiSlice";
import { ToolPolicyItem } from "./ToolPolicyItem";

interface ToolPoliciesGroupProps {
  groupName: string;
  tools: Tool[];
  isGroupEnabled: boolean;
  isExpanded: boolean;
  allToolsOff: boolean;
  duplicateDetection: Record<string, boolean>;
  onToggleGroup: (groupName: string) => void;
}

export function ToolPoliciesGroup({
  groupName,
  tools,
  isGroupEnabled,
  isExpanded,
  allToolsOff,
  duplicateDetection,
  onToggleGroup,
}: ToolPoliciesGroupProps) {
  const dispatch = useAppDispatch();

  return (
    <Card>
      <div className="flex flex-col">
        <div
          className="-mx-2 flex cursor-pointer items-center justify-between gap-3 rounded px-2 py-2 hover:bg-gray-50 hover:bg-opacity-5"
          onClick={() => onToggleGroup(groupName)}
        >
          <div className="flex items-center gap-3">
            <ChevronDownIcon
              className={`text-description h-3 w-3 transition-transform ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{groupName}</span>
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-600 text-xs font-medium text-white">
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
            <div
              onClick={(e) => {
                e.stopPropagation();
                dispatch(toggleToolGroupSetting(groupName));
              }}
            >
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
          <div className="mt-3 space-y-1">
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
      </div>
    </Card>
  );
}
