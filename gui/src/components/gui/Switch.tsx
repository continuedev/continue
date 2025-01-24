import React from "react";

type ToggleSwitchProps = {
  isToggled: boolean;
  onToggle: () => void;
  text: string;
};

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  isToggled,
  onToggle,
  text,
}) => {
  return (
    <label
      htmlFor="toggle"
      className="flex cursor-pointer select-none items-center justify-end gap-3"
    >
      <span className="lines lines-1 text-right">{text}</span>
      <div>
        <div
          id={`toggle-${text}`}
          className={`border-vsc-input-border bg-vsc-input-background flex h-5 w-10 items-center rounded-full border border-solid p-0.5`}
          onClick={onToggle}
        >
          <div className="relative h-full w-full">
            <div
              className={`absolute left-1/4 top-0 h-full w-1/2 transform rounded-full transition-all ${isToggled ? "translate-x-1/2 bg-green-500" : "-translate-x-1/2 bg-red-500"}`}
            />
          </div>
        </div>
      </div>
    </label>
  );
};

export default ToggleSwitch;
