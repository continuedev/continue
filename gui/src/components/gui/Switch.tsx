import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import React from "react";
import { vscButtonBackground } from "..";
import { ToolTip } from "./Tooltip";

type ToggleSwitchProps = {
  isToggled: boolean;
  onToggle: () => void;
  text: string;
  size?: number;
  onWarningText?: string;
};

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  isToggled,
  onToggle,
  text,
  size = 16,
  onWarningText,
}) => {
  return (
    <div className="flex cursor-pointer select-none items-center justify-between gap-3">
      <span className="truncate-right">{text}</span>
      <div className="flex flex-row items-center gap-1">
        {isToggled && !!onWarningText && (
          <>
            <ExclamationTriangleIcon
              data-tooltip-id={`${text}-warning-tooltip`}
              className="text-yellow-500"
              style={{
                height: size,
                width: size,
              }}
            />
            <ToolTip id={`${text}-warning-tooltip`}>{onWarningText}</ToolTip>
          </>
        )}
        <div
          className={`border-vsc-input-border bg-vsc-input-background flex items-center rounded-full border border-solid`}
          onClick={onToggle}
          style={{
            height: size,
            width: size * 2,
            padding: size / 8,
          }}
        >
          <div className="relative h-full w-full">
            <div
              className={`absolute left-1/4 top-0 h-full w-1/2 transform rounded-full border-[0.2px] border-solid transition-all ${isToggled ? "translate-x-1/2 brightness-150" : "-translate-x-1/2 brightness-75"}`}
              style={{
                backgroundColor: isToggled ? vscButtonBackground : "",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToggleSwitch;
