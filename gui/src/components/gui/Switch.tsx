import React from "react";
import { vscButtonBackground } from "..";

type ToggleSwitchProps = {
  isToggled: boolean;
  onToggle: () => void;
  text: string;
  size?: number;
};

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  isToggled,
  onToggle,
  text,
  size = 16,
}) => {
  return (
    <div className="flex cursor-pointer select-none items-center justify-between gap-3">
      <span className="truncate-right">{text}</span>
      <div>
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
