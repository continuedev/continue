import { Divider } from "./Divider";
import { TabButton } from "./TabButton";

interface TabOption {
  id: string;
  label: string;
  component: React.ReactNode;
  icon: React.ReactNode;
  keywords?: string[];
}

interface TabGroupProps {
  tabs: TabOption[];
  activeTab: string;
  onTabClick: (tabId: string) => void;
  label?: string;
  showTopDivider?: boolean;
  showBottomDivider?: boolean;
  className?: string;
}

export function TabGroup({
  tabs,
  activeTab,
  onTabClick,
  label,
  showTopDivider = false,
  showBottomDivider = false,
  className = "",
}: TabGroupProps) {
  return (
    <div className={className}>
      {showTopDivider && <Divider />}

      {label && (
        <div className="text-description-muted mb-1.5 ml-2 hidden text-[11px] font-semibold uppercase tracking-[0.08em] md:block md:pt-1">
          {label}
        </div>
      )}

      {tabs.map((tab) => (
        <TabButton
          key={tab.id}
          label={tab.label}
          icon={tab.icon}
          tabId={tab.id}
          isActive={activeTab === tab.id}
          onClick={() => onTabClick(tab.id)}
        />
      ))}

      {showBottomDivider && <Divider />}
    </div>
  );
}
