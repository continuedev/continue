import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { useNavigationListener } from "../../hooks/useNavigationListener";
import { topTabSections, bottomTabSections, getAllTabs } from "./configTabs";
import { TabGroup } from "./TabGroup";

function ConfigPage() {
  useNavigationListener();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("settings");

  const allTabs = getAllTabs();

  return (
    <div className="flex h-full flex-row overflow-hidden">
      {/* Vertical Sidebar - full height */}
      <div className="bg-vsc-background flex w-12 flex-shrink-0 flex-col border-0 md:w-32">
        <div className="border-r-border flex flex-1 flex-col overflow-y-auto border-b-0 border-l-0 border-r-2 border-t-0 border-solid p-2">
          {topTabSections.map((section) => (
            <TabGroup
              key={section.id}
              tabs={section.tabs}
              activeTab={activeTab}
              onTabClick={setActiveTab}
              label={section.label}
              showTopDivider={section.showTopDivider}
              showBottomDivider={section.showBottomDivider}
              className={section.className}
            />
          ))}
          
          <div className="flex-1" />
          
          <div className="md:border-description-muted hidden md:block md:border-t md:pt-2" />
          {bottomTabSections.map((section) => (
            <TabGroup
              key={section.id}
              tabs={section.tabs}
              activeTab={activeTab}
              onTabClick={setActiveTab}
              label={section.label}
              showTopDivider={section.showTopDivider}
              showBottomDivider={section.showBottomDivider}
              className={section.className}
            />
          ))}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <PageHeader onTitleClick={() => navigate("/")} title="Back" />
        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto px-4">
          {allTabs.find((tab) => tab.id === activeTab)?.component}
        </div>
      </div>
    </div>
  );
}

export default ConfigPage;
