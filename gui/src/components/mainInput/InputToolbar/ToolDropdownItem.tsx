import { Tool } from "core";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { addTool, toggleToolSetting } from "../../../redux/slices/uiStateSlice";
import { RootState } from "../../../redux/store";

interface ToolDropdownItemProps {
  tool: Tool;
}

function ToolDropdownItem(props: ToolDropdownItemProps) {
  const dispatch = useDispatch();
  const settings = useSelector(
    (state: RootState) => state.uiState.toolSettings[props.tool.function.name],
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
      className="flex w-full items-center justify-between gap-2 px-2 py-1"
      onClick={(e) => {
        dispatch(toggleToolSetting(props.tool.function.name));
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      <span>{props.tool.displayTitle}</span>
      <div className="flex gap-2 pr-4">
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
