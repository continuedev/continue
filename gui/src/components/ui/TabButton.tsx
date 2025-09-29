import { ToolTip } from "../gui/Tooltip";

interface TabButtonProps {
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  tabId?: string;
}

export function TabButton({
  label,
  icon,
  isActive,
  onClick,
  tabId,
}: TabButtonProps) {
  return (
    <ToolTip content={label} place="right" className="text-xs md:!hidden">
      <div
        className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-md hover:brightness-125 md:justify-start ${
          isActive
            ? "bg-vsc-input-background px-2 py-2"
            : "text-description px-2 py-2"
        }`}
        onClick={onClick}
        data-testid={tabId ? `tab-${tabId}` : undefined}
      >
        {icon}
        <span className="text-description hidden md:inline">{label}</span>
      </div>
    </ToolTip>
  );
}
