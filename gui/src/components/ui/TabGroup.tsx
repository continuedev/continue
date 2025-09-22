import { Divider } from "./Divider";
import { TabButton } from "./TabButton";

interface TabOption {
  id: string;
  label: string;
  component: React.ReactNode;
  icon: React.ReactNode;
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
        <div className="text-description-muted text-2xs mb-1 ml-1.5 hidden font-medium md:block md:pt-1">
          {label}
        </div>
      )}

      {tabs.map((tab) => (
        <TabButton
          key={tab.id}
          label={tab.label}
          icon={tab.icon}
          isActive={activeTab === tab.id}
          onClick={() => onTabClick(tab.id)}
        />
      ))}

      {showBottomDivider && <Divider />}
    </div>
  );
}
