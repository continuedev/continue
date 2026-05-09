import {
  ChevronDownIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { Tool } from "core";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "core/tools/builtIn";
import { useMemo, useState } from "react";
import ToggleSwitch from "../../../components/gui/Switch";
import { ToolTip } from "../../../components/gui/Tooltip";
import { Card } from "../../../components/ui";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { toggleToolGroupSetting } from "../../../redux/slices/uiSlice";
import { cn } from "../../../util/cn";
import { ToolPolicyItem } from "./ToolPolicyItem";

interface ToolPoliciesGroupProps {
  showIcon: boolean;
  groupName: string;
  displayName: string;
  allToolsOff: boolean;
  duplicateDetection: Record<string, boolean>;
  surface?: "card" | "embedded";
}

// Browser-standalone fallback should mirror the extension's default tool set
// (base tools + common config-dependent tools) rather than the full enum.
const FALLBACK_BROWSER_TOOL_NAMES: BuiltInToolNames[] = [
  BuiltInToolNames.ReadFile,
  BuiltInToolNames.CreateNewFile,
  BuiltInToolNames.RunTerminalCommand,
  BuiltInToolNames.FileGlobSearch,
  BuiltInToolNames.EnterPlanMode,
  BuiltInToolNames.ExitPlanMode,
  BuiltInToolNames.NotebookEdit,
  BuiltInToolNames.ViewDiff,
  BuiltInToolNames.ReadCurrentlyOpenFile,
  BuiltInToolNames.LSTool,
  BuiltInToolNames.CreateRuleBlock,
  BuiltInToolNames.FetchUrlContent,
  BuiltInToolNames.Sleep,
  BuiltInToolNames.Subagent,
  BuiltInToolNames.TodoWrite,
  BuiltInToolNames.AskUserQuestion,
  BuiltInToolNames.LspQuery,
  BuiltInToolNames.NotifyUser,
  BuiltInToolNames.EnterWorktree,
  BuiltInToolNames.ExitWorktree,
  BuiltInToolNames.ToolSearch,
  BuiltInToolNames.RequestRule,
  BuiltInToolNames.ReadSkill,
  BuiltInToolNames.Skill,
  BuiltInToolNames.EditExistingFile,
  BuiltInToolNames.SingleFindAndReplace,
  BuiltInToolNames.GrepSearch,
];

export function ToolPoliciesGroup({
  showIcon,
  groupName,
  displayName,
  allToolsOff,
  duplicateDetection,
  surface = "card",
}: ToolPoliciesGroupProps) {
  const dispatch = useAppDispatch();
  const [isExpanded, setIsExpanded] = useState(false);

  const availableTools = useAppSelector(
    (state) => state.config.config.tools as Tool[],
  );

  // In standalone browser dev mode, config bootstrap can come up with an empty
  // tool list before an IDE host responds. Fall back to built-in tool defs so
  // the Tools screen remains usable and doesn't show a misleading zero count.
  const fallbackBuiltInTools = useMemo(() => {
    return FALLBACK_BROWSER_TOOL_NAMES.map((toolName) => {
      return {
        type: "function",
        function: {
          name: toolName,
          description: "Built-in tool",
        },
        displayTitle: toolName,
        wouldLikeTo: `use ${toolName}`,
        readonly: false,
        group: BUILT_IN_GROUP_NAME,
      } as Tool;
    });
  }, []);

  const effectiveTools = useMemo(
    () => (availableTools.length > 0 ? availableTools : fallbackBuiltInTools),
    [availableTools, fallbackBuiltInTools],
  );

  const tools = useMemo(() => {
    return effectiveTools.filter((t) => t.group === groupName);
  }, [effectiveTools, groupName]);

  const toolGroupSettings = useAppSelector(
    (state) => state.ui.toolGroupSettings,
  );
  const toolSettings = useAppSelector((state) => state.ui.toolSettings);
  const isGroupEnabled = useMemo(() => {
    return toolGroupSettings[groupName] !== "exclude";
  }, [toolGroupSettings, groupName]);

  const { enabledCount, totalCount } = useMemo(() => {
    const total = tools.length;
    const enabled = tools.filter(
      (tool) => toolSettings[tool.function.name] !== "disabled",
    ).length;
    return { enabledCount: enabled, totalCount: total };
  }, [tools, toolSettings]);

  const badgeText = useMemo(() => {
    if (enabledCount === totalCount) {
      return totalCount.toString();
    }
    return `${enabledCount}/${totalCount}`;
  }, [enabledCount, totalCount]);

  const content = (
    <>
      <div
        className="hover:bg-vsc-input-background/60 flex cursor-pointer items-center justify-between gap-3 rounded-lg px-4 py-3"
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
            <div className="bg-vsc-input-background text-vsc-foreground flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium">
              {badgeText}
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
        <div className="mt-2 space-y-1 px-2 pb-2">
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
    </>
  );

  if (surface === "embedded") {
    return <div className="flex flex-1 flex-col">{content}</div>;
  }

  return (
    <Card className={cn("flex flex-1 flex-col overflow-hidden p-0")}>
      {content}
    </Card>
  );
}
