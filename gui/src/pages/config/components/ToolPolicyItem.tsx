import { ToolPolicy } from "@continuedev/terminal-security";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { Tool } from "core";
import { BUILT_IN_GROUP_NAME } from "core/tools/builtIn";
import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { Tooltip } from "react-tooltip";
import { ToolTip } from "../../../components/gui/Tooltip";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "../../../components/ui";
import { useFontSize } from "../../../components/ui/font";
import { useAppSelector } from "../../../redux/hooks";
import { addTool, setToolPolicy } from "../../../redux/slices/uiSlice";

interface ToolPolicyItemProps {
  tool: Tool;
  duplicatesDetected: boolean;
  isGroupEnabled: boolean;
}

export function ToolPolicyItem(props: ToolPolicyItemProps) {
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
  const disabledTooltipId = `disabled-note-${props.tool.group}-${props.tool.displayTitle}-${props.tool.function.name}`;

  return (
    <div
      className="flex flex-col"
      style={{
        fontSize,
      }}
    >
      <div className="flex flex-col rounded px-2 py-2 hover:bg-gray-50 hover:bg-opacity-5">
        <div className="flex flex-row items-start justify-between">
          <div
            className="flex flex-1 cursor-pointer flex-row items-start gap-1.5"
            onClick={() => setIsExpanded((val) => !val)}
          >
            <ChevronRightIcon
              className={`xs:flex hidden h-3 w-3 flex-shrink-0 pt-1 transition-all duration-200 ${isExpanded ? "rotate-90" : ""}`}
            />

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
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
                <span className="line-clamp-1 break-all text-sm">
                  {props.tool.originalFunctionName ?? props.tool.function.name}
                </span>
              </div>
              <div className="text-description line-clamp-3 text-sm">
                {props.tool.function.description}
              </div>
            </div>
          </div>

          <div className="flex w-20 justify-end sm:w-24">
            <Listbox
              value={disabled || policy === "disabled" ? "disabled" : policy}
              onChange={(newPolicy) => {
                if (!disabled && newPolicy !== policy) {
                  dispatch(
                    setToolPolicy({
                      toolName: props.tool.function.name,
                      policy: newPolicy as ToolPolicy,
                    }),
                  );
                }
              }}
              disabled={disabled}
            >
              <div className="relative">
                <ListboxButton
                  className={`border-command-border h-7 w-full justify-between px-3 ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                  data-testid={`tool-policy-item-${props.tool.function.name}`}
                  data-tooltip-id={disabled ? disabledTooltipId : undefined}
                >
                  <span className="text-xs">
                    {disabled || policy === "disabled"
                      ? "Excluded"
                      : policy === "allowedWithoutPermission"
                        ? "Automatic"
                        : "Ask First"}
                  </span>
                  <ChevronDownIcon className="h-3 w-3" />
                </ListboxButton>
                {!disabled && (
                  <ListboxOptions className="min-w-0">
                    <ListboxOption value="allowedWithoutPermission">
                      Automatic
                    </ListboxOption>
                    <ListboxOption value="allowedWithPermission">
                      Ask First
                    </ListboxOption>
                    <ListboxOption value="disabled">Excluded</ListboxOption>
                  </ListboxOptions>
                )}
              </div>
            </Listbox>
          </div>
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
        <span className="text-2xs mt-1.5 font-bold">Description:</span>
        <span className="text-2xs italic">
          {props.tool.function.description}
        </span>
        {parameters ? (
          <>
            <span className="text-2xs font-bold">Arguments:</span>
            {parameters.map((param, idx) => (
              <div key={idx} className="text-2xs block">
                <code className="">{param[0]}</code>
                <span className="ml-1">{`(${param[1].type ?? "unknown"}):`}</span>
                <span className="ml-1 italic">
                  {param[1].description ?? "No description"}
                </span>
              </div>
            ))}
          </>
        ) : null}
        <div className="h-1"></div>
      </div>
    </div>
  );
}
