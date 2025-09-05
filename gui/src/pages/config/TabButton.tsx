import { v4 as uuidv4 } from "uuid";
import { ToolTip } from "../../components/gui/Tooltip";
import { fontSize } from "../../util";

interface TabButtonProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}

export function TabButton({ id, label, icon, isActive, onClick }: TabButtonProps) {
  const tooltipId = `tab-tooltip-${uuidv4()}`;

  return (
    <div>
      <div
        style={{
          fontSize: fontSize(-2),
        }}
        className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-md hover:brightness-125 md:justify-start ${
          isActive
            ? "bg-vsc-input-background px-2 py-2"
            : "text-description px-2 py-2"
        }`}
        onClick={onClick}
        data-tooltip-id={tooltipId}
      >
        {icon}
        <span className="hidden md:inline">{label}</span>
      </div>

      <ToolTip
        id={tooltipId}
        place="right"
        className="md:!hidden"
        style={{ fontSize: fontSize(-2) }}
      >
        {label}
      </ToolTip>
    </div>
  );
}