import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { Tool } from "core";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { useAppSelector } from "../../../redux/hooks";
import { addTool, toggleToolSetting } from "../../../redux/slices/uiSlice";
import { ToolTip } from "../../gui/Tooltip";

interface ToolDropdownItemProps {
  tool: Tool;
  duplicatesDetected: boolean;
}

function ToolDropdownItem(props: ToolDropdownItemProps) {
  const dispatch = useDispatch();
  const settings = useAppSelector(
    (state) => state.ui.toolSettings[props.tool.function.name],
  );

  useEffect(() => {
    if (!settings) {
      dispatch(addTool(props.tool));
    }
  }, [props.tool.function.name, settings]);

  if (!settings) {
    return null;
  }

  return (
    <div
      className="text-vsc-foreground flex cursor-pointer items-center justify-between gap-2 py-1 pl-2 pr-1 text-left text-xs brightness-75 hover:brightness-125"
      onClick={(e) => {
        dispatch(toggleToolSetting(props.tool.function.name));
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      <div className="flex flex-1 flex-row items-center gap-1">
        {props.duplicatesDetected ? (
          <>
            <div>
              <InformationCircleIcon
                data-tooltip-id={props.tool.displayTitle + "-duplicate-warning"}
                className="h-3 w-3 cursor-help text-yellow-500"
              />
            </div>
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
        <span className="lines lines-1 flex items-center gap-1">
          {props.tool.faviconUrl && (
            <img
              src={props.tool.faviconUrl}
              alt={props.tool.displayTitle}
              className="h-4 w-4"
            />
          )}
          {props.tool.displayTitle}{" "}
        </span>
      </div>
      <div className="flex cursor-pointer gap-2">
        {(settings === "allowedWithPermission" || settings === undefined) && (
          <span className="text-yellow-500">Allowed</span>
        )}
        {settings === "allowedWithoutPermission" && (
          <span className="text-green-500">Automatic</span>
        )}
        {settings === "disabled" && (
          <span className="text-red-500">Disabled</span>
        )}
      </div>
    </div>
  );
}

export default ToolDropdownItem;
