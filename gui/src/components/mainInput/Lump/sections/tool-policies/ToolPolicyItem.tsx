import {
  ChevronRightIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { Tool } from "core";
import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useAppSelector } from "../../../../../redux/hooks";
import {
  addTool,
  toggleToolSetting,
} from "../../../../../redux/slices/uiSlice";
import { ToolTip } from "../../../../gui/Tooltip";
import { useFontSize } from "../../../../ui/font";

interface ToolDropdownItemProps {
  tool: Tool;
  duplicatesDetected: boolean;
  excluded: boolean;
}

function ToolPolicyItem(props: ToolDropdownItemProps) {
  const dispatch = useDispatch();
  const policy = useAppSelector(
    (state) => state.ui.toolSettings[props.tool.function.name],
  );
  const [isExpanded, setIsExpanded] = useState(false);

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

  if (!policy) {
    return null;
  }

  return (
    <div
      className="flex flex-col"
      style={{
        fontSize,
      }}
    >
      <div className="flex flex-row items-center">
        <div
          className={`hover:bg-list-active hover:text-list-active-foreground xs:gap-1.5 flex flex-1 cursor-pointer flex-row items-center gap-1 py-0.5 pl-1 pr-2`}
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
              <>
                <InformationCircleIcon
                  data-tooltip-id={
                    props.tool.displayTitle + "-duplicate-warning"
                  }
                  className="h-3 w-3 flex-shrink-0 cursor-help text-yellow-500"
                />
                <ToolTip
                  id={props.tool.displayTitle + "-duplicate-warning"}
                  place="bottom"
                  className="flex flex-wrap items-center"
                >
                  <p className="m-0 p-0">
                    <span>Duplicate tool name</span>{" "}
                    <code>{props.tool.function.name}</code>{" "}
                    <span>
                      detected. Permissions will conflict and usage may be
                      unpredictable
                    </span>
                  </p>
                </ToolTip>
              </>
            ) : null}
            {props.tool.faviconUrl && (
              <img
                src={props.tool.faviconUrl}
                alt={props.tool.displayTitle}
                className="h-3 w-3 flex-shrink-0"
              />
            )}
            <span className="line-clamp-1 break-all">
              {props.tool.function.name}
            </span>
          </div>
        </div>
        <div
          className={`flex w-8 flex-row items-center justify-end gap-2 px-2 py-0.5 sm:w-16 ${props.excluded ? "cursor-not-allowed" : "hover:bg-list-active hover:text-list-active-foreground cursor-pointer"}`}
          data-testid={`tool-policy-item-${props.tool.function.name}`}
          onClick={(e) => {
            dispatch(toggleToolSetting(props.tool.function.name));
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          {props.excluded || policy === "disabled" ? (
            <>
              <span className="text-lightgray sm:hidden">Off</span>
              <span className="text-lightgray hidden sm:inline-block">
                Excluded
              </span>
            </>
          ) : policy === "allowedWithoutPermission" ? (
            <>
              <span className="text-green-500 sm:hidden">Auto</span>
              <span className="hidden text-green-500 sm:inline-block">
                Automatic
              </span>
            </>
          ) : (
            // allowedWithPermission
            <>
              <span className="text-yellow-500 sm:hidden">Ask</span>
              <span className="hidden text-yellow-500 sm:inline-block">
                Ask First
              </span>
            </>
          )}
        </div>
      </div>
      <div
        className={`flex flex-col overflow-hidden ${isExpanded ? "h-min" : "h-0 opacity-0"} gap-x-1 gap-y-2 pl-2 transition-all`}
      >
        <span className="mt-1.5 text-xs font-bold">Description:</span>
        <span className="italic">{props.tool.function.description}</span>
        {parameters ? (
          <>
            <span className="text-xs font-bold">Arguments:</span>
            {parameters.map((param) => (
              <div className="block">
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

export default ToolPolicyItem;
