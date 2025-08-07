import { MessageModes, Tool } from "core";
import { useMemo } from "react";
import { useAppDispatch, useAppSelector } from "../../../../../redux/hooks";
import { toggleToolGroupSetting } from "../../../../../redux/slices/uiSlice";
import { fontSize } from "../../../../../util";
import Alert from "../../../../gui/Alert";
import ToggleSwitch from "../../../../gui/Switch";
import ToolPolicyItem from "./ToolPolicyItem";

export const ToolPoliciesSection = () => {
  const mode = useAppSelector((state) => state.session.mode);
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

  return (
    <>
      {(mode === "chat" || mode === "plan") && (
        <div className="bg-background sticky top-0 z-10 my-1 mb-3">
          <Alert type="info" size="sm">
            <span className="text-2xs italic">{message}</span>
          </Alert>
        </div>
      )}
      {toolsByGroup.length === 0 && (
        <span className="text-description text-sm italic">
          No tools available
        </span>
      )}
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
