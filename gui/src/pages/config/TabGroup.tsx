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
      {showTopDivider && (
        <div className="mx-1 my-2 border-gray-600 border-b border-solid border-[0.5px] opacity-30" />
      )}

      {label && (
        <div className="text-description-muted text-2xs mb-2 ml-1.5 hidden font-medium md:block md:pt-1">
          {label}
        </div>
      )}

      {tabs.map((tab) => (
        <TabButton
          key={tab.id}
          id={tab.id}
          label={tab.label}
          icon={tab.icon}
          isActive={activeTab === tab.id}
          onClick={() => onTabClick(tab.id)}
        />
      ))}

      {showBottomDivider && (
        <div className="md:border-description-muted mx-1 my-4 md:!border-[0.5px] md:border-b md:border-solid" />
      )}
    </div>
  );
}
