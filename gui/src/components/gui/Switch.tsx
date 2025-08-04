import React, { ReactNode } from "react";
import { vscButtonBackground } from "..";

type ToggleSwitchProps = {
  isToggled: boolean;
  onToggle: () => void;
  text: string;
  size?: number;
  showIfToggled?: ReactNode;
  disabled?: boolean;
};

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  isToggled,
  onToggle,
  text,
  size = 16,
  showIfToggled,
  disabled = false,
}) => {
  return (
    <div
      className={`flex select-none items-center justify-between gap-3 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span className="truncate-right">{text}</span>
      <div className="flex flex-row items-center gap-1">
        {isToggled && !!showIfToggled && showIfToggled}
        <div
          className={`border-vsc-input-border bg-vsc-input-background relative flex items-center rounded-full border border-solid`}
          onClick={disabled ? undefined : onToggle}
          style={{
            height: size,
            width: size * 2,
            padding: size / 8,
          }}
        >
          <div
            className={`absolute left-1/4 transform rounded-full border-[0.2px] border-solid transition-all ${isToggled ? "translate-x-1/2 brightness-150" : "-translate-x-1/2 brightness-75"}`}
            style={{
              backgroundColor: isToggled ? vscButtonBackground : "",
              height: size,
              width: size,
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default ToggleSwitch;
