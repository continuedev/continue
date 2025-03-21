import {
  EllipsisHorizontalCircleIcon as EllipsisHorizontalIcon,
  WrenchScrewdriverIcon as WrenchScrewdriverIconOutline,
} from "@heroicons/react/24/outline";
import { WrenchScrewdriverIcon as WrenchScrewdriverIconSolid } from "@heroicons/react/24/solid";
import { useState } from "react";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { selectIsInEditMode } from "../../../redux/slices/sessionSlice";
import {
  setDialogMessage,
  setShowDialog,
  toggleUseTools,
} from "../../../redux/slices/uiSlice";
import { ToolTip } from "../../gui/Tooltip";
import HoverItem from "./HoverItem";
import ToolPermissionsDialog from "./ToolPermissionsDialog";

interface ToggleToolsButtonProps {
  disabled: boolean;
}

export default function ToggleToolsButton(props: ToggleToolsButtonProps) {
  const dispatch = useAppDispatch();
  const [isHovered, setIsHovered] = useState(false);

  const useTools = useAppSelector((state) => state.ui.useTools);
  const isInEditMode = useAppSelector(selectIsInEditMode);

  const ToolsIcon = useTools
    ? WrenchScrewdriverIconSolid
    : WrenchScrewdriverIconOutline;

  function showTools() {
    dispatch(setDialogMessage(<ToolPermissionsDialog />));
    dispatch(setShowDialog(true));
  }

  const isDisabled = props.disabled || isInEditMode;

  return (
    <HoverItem onClick={() => !isDisabled && dispatch(toggleUseTools())}>
      <div
        data-tooltip-id="tools-tooltip"
        className={`-ml-1 -mt-1 flex flex-row items-center gap-1.5 rounded-md px-1 py-0.5 text-xs ${
          (useTools || isHovered) && !isDisabled ? "bg-lightgray/30" : ""
        } ${isDisabled ? "cursor-not-allowed opacity-50" : ""}`}
      >
        <ToolsIcon
          className={`h-4 w-4 text-gray-400 ${
            isDisabled ? "cursor-not-allowed" : ""
          }`}
          onMouseEnter={() => !isDisabled && setIsHovered(true)}
          onMouseLeave={() => !isDisabled && setIsHovered(false)}
        />
        {isDisabled && (
          <ToolTip id="tools-tooltip" place="top-middle">
            {isInEditMode
              ? "Tool use not supported in edit mode"
              : "This model does not support tool use"}
          </ToolTip>
        )}
        {!useTools && !isDisabled && (
          <ToolTip id="tools-tooltip" place="top-middle">
            Enable tool usage
          </ToolTip>
        )}

        {useTools && !isDisabled && (
          <>
            <span className="hidden align-top sm:flex">Tools</span>
            <div
              data-tooltip-id="tools-permissions"
              onClick={(e) => {
                e.stopPropagation();
                showTools();
              }}
              className="text-lightgray flex cursor-pointer items-center"
              aria-disabled={isDisabled}
            >
              <EllipsisHorizontalIcon className="h-3 w-3 cursor-pointer hover:brightness-125" />
            </div>
            <ToolTip id="tools-permissions">Tool policies</ToolTip>
          </>
        )}
      </div>
    </HoverItem>
  );
}
