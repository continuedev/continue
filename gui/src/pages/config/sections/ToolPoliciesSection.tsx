import {
  ChevronRightIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { MessageModes, Tool } from "core";
import { BUILT_IN_GROUP_NAME } from "core/tools/builtIn";
import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { Tooltip } from "react-tooltip";
import Alert from "../../../components/gui/Alert";
import ToggleSwitch from "../../../components/gui/Switch";
import { ToolTip } from "../../../components/gui/Tooltip";
import { Card } from "../../../components/ui";
import { useFontSize } from "../../../components/ui/font";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import {
  addTool,
  toggleToolGroupSetting,
  toggleToolSetting,
} from "../../../redux/slices/uiSlice";
import { fontSize } from "../../../util";
import { ConfigHeader } from "../ConfigHeader";

interface ToolDropdownItemProps {
  tool: Tool;
  duplicatesDetected: boolean;
  isGroupEnabled: boolean;
}

function ToolPolicyItem(props: ToolDropdownItemProps) {
  const dispatch = useDispatch();
  const policy = useAppSelector(
    (state) => state.ui.toolSettings[props.tool.function.name],
  );
  const [isExpanded, setIsExpanded] = useState(false);
  const mode = useAppSelector((state) => state.session.mode);

  useEffect(() => {
    if (!policy) {
      dispatch(addTool(props.tool));
    }
  }, [props.tool.function.name, policy]);

  const parameters = useMemo(() => {
    if (props.tool.function.parameters?.properties) {
      return Object.entries(props.tool.function.parameters.properties).map(
        ([name, schema]) =>
          [name, schema] as [string, { description: string; type: string }],
      );
    }
    return undefined;
  }, [props.tool.function.parameters]);

  const fontSize = useFontSize(-2);

  const disabled =
    !props.isGroupEnabled ||
    (mode === "plan" &&
      props.tool.group === BUILT_IN_GROUP_NAME &&
      !props.tool.readonly);

  if (!policy) {
    return null;
  }
  const disabledTooltipId = `disabled-note-${props.tool.function.name}`;

  return (
    <div
      className="flex flex-col"
      style={{
        fontSize,
      }}
    >
      <div className="flex flex-row items-center">
        <div
          className={`hover:bg-badge hover:text-list-active-foreground xs:gap-1.5 flex flex-1 cursor-pointer flex-row items-center gap-1 rounded py-0.5 pl-1 pr-2`}
          onClick={() => setIsExpanded((val) => !val)}
        >
          <ChevronRightIcon
            className={`xs:flex hidden h-3 w-3 flex-shrink-0 transition-all duration-200 ${isExpanded ? "rotate-90" : ""}`}
          />

          <div
            className={`flex items-center gap-1 rounded-md`}
            style={{
              fontSize,
            }}
          >
            {props.duplicatesDetected ? (
              <ToolTip
                place="bottom"
                className="flex flex-wrap items-center"
                content={
                  <p className="m-0 p-0">
                    <span>Duplicate tool name</span>{" "}
                    <code>{props.tool.function.name}</code>{" "}
                    <span>
                      detected. Permissions will conflict and usage may be
                      unpredictable
                    </span>
                  </p>
                }
              >
                <InformationCircleIcon className="h-3 w-3 flex-shrink-0 cursor-help text-yellow-500" />
              </ToolTip>
            ) : null}
            {props.tool.faviconUrl && (
              <img
                src={props.tool.faviconUrl}
                alt={props.tool.displayTitle}
                className="h-3 w-3 flex-shrink-0"
              />
            )}
            <span className="line-clamp-1 break-all">
              {props.tool.originalFunctionName ?? props.tool.function.name}
            </span>
          </div>
        </div>

        <div
          className={`flex w-8 select-none flex-row items-center justify-end gap-2 px-2 py-0.5 sm:w-16 ${disabled ? "cursor-not-allowed" : "hover:text-list-active-foreground cursor-pointer hover:brightness-125"}`}
          data-testid={`tool-policy-item-${props.tool.function.name}`}
          data-tooltip-id={disabled ? disabledTooltipId : undefined}
          onClick={
            disabled
              ? undefined
              : (e) => {
                  dispatch(toggleToolSetting(props.tool.function.name));
                  e.stopPropagation();
                  e.preventDefault();
                }
          }
        >
          {disabled || policy === "disabled" ? (
            <>
              <span className="text-lightgray sm:hidden">Off</span>
              <span className="text-lightgray hidden sm:inline-block">
                Excluded
              </span>
            </>
          ) : policy === "allowedWithoutPermission" ? (
            <>
              <span className="text-success sm:hidden">Auto</span>
              <span className="text-success hidden sm:inline-block">
                Automatic
              </span>
            </>
          ) : (
            // allowedWithPermission
            <>
              <span className="text-warning sm:hidden">Ask</span>
              <span className="text-warning hidden sm:inline-block">
                Ask First
              </span>
            </>
          )}
        </div>
        <Tooltip id={disabledTooltipId}>
          {mode === "chat"
            ? "Tool disabled in chat mode"
            : !props.isGroupEnabled
              ? "Group is turned off"
              : "Tool disabled in plan mode"}
        </Tooltip>
      </div>
      <div
        className={`flex flex-col overflow-hidden ${isExpanded ? "h-min" : "h-0 opacity-0"} gap-x-1 gap-y-2 pl-2 transition-all`}
      >
        <span className="mt-1.5 text-xs font-bold">Description:</span>
        <span className="italic">{props.tool.function.description}</span>
        {parameters ? (
          <>
            <span className="text-xs font-bold">Arguments:</span>
            {parameters.map((param, idx) => (
              <div key={idx} className="block">
                <code className="">{param[0]}</code>
                <span className="ml-1">{`(${param[1].type}):`}</span>
                <span className="ml-1 italic">{param[1].description}</span>
              </div>
            ))}
          </>
        ) : null}
        <div className="h-1"></div>
      </div>
    </div>
  );
}

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
    <div>
      <ConfigHeader title="Tool Policies" />

      <Card>
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
      </Card>
    </div>
  );
};
