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
    <ToolTip content={label} place="right" className="text-xs lg:!hidden">
      <div
        className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-solid py-2 transition-colors lg:justify-start lg:px-2.5 ${
          isActive
            ? "border-border bg-vsc-input-background text-vsc-foreground"
            : "text-description hover:bg-vsc-input-background/70 hover:text-vsc-foreground border-transparent"
        }`}
        onClick={onClick}
        data-testid={tabId ? `tab-${tabId}` : undefined}
      >
        {icon}
        <span
          className={`hidden min-w-0 truncate text-sm lg:inline ${
            isActive ? "text-vsc-foreground" : "text-description"
          }`}
        >
          {label}
        </span>
      </div>
    </ToolTip>
  );
}
