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
  return (
    <ToolTip
      content={label}
      place="right"
      className="md:!hidden"
      style={{ fontSize: fontSize(-2) }}
    >
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
      >
        {icon}
        <span className="hidden md:inline">{label}</span>
      </div>
    </ToolTip>
  );
}