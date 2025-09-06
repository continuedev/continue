import { isOnPremSession } from "core/control-plane/AuthTypes";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ScopeSelect } from "../../components/AssistantAndOrgListbox/ScopeSelect";
import { Divider } from "../../components/ui/Divider";
import { useAuth } from "../../context/Auth";
import { useNavigationListener } from "../../hooks/useNavigationListener";
import { bottomTabSections, getAllTabs, topTabSections } from "./configTabs";
import { TabGroup } from "./components/ui/TabGroup";
import { AccountDropdown } from "./features/account/AccountDropdown";

function ConfigPage() {
  useNavigationListener();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("settings");
  const { session, organizations } = useAuth();

  // Set initial tab from URL parameter
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const allTabs = getAllTabs();
  const shouldRenderOrgInfo =
    session && organizations.length > 1 && !isOnPremSession(session);

  const handleTabClick = (tabId: string) => {
    if (tabId === "back") {
      navigate("/");
    } else {
      setActiveTab(tabId);
    }
  };

  return (
    <div className="flex h-full flex-row overflow-hidden">
      {/* Vertical Sidebar - full height */}
      <div className="bg-vsc-background flex w-12 flex-shrink-0 flex-col border-0 md:w-36">
        <div className="border-r-border flex flex-1 flex-col overflow-y-auto border-b-0 border-l-0 border-r-2 border-t-0 border-solid p-2">
          {topTabSections.map((section, index) => (
            <>
              <TabGroup
                key={section.id}
                tabs={section.tabs}
                activeTab={activeTab}
                onTabClick={handleTabClick}
                label={section.label}
                showTopDivider={section.showTopDivider}
                showBottomDivider={section.showBottomDivider}
                className={section.className}
              />
              {index === 0 && shouldRenderOrgInfo && (
                <>
                  <Divider />
                  <ScopeSelect allowCompact />
                </>
              )}
            </>
          ))}

          <div className="flex-1" />

          {bottomTabSections.map((section) => (
            <TabGroup
              key={section.id}
              tabs={section.tabs}
              activeTab={activeTab}
              onTabClick={handleTabClick}
              label={section.label}
              showTopDivider={section.showTopDivider}
              showBottomDivider={section.showBottomDivider}
              className={section.className}
            />
          ))}

          <Divider />

          <AccountDropdown />
        </div>
      </div>

      {/* Main content area */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto px-4">
          {allTabs.find((tab) => tab.id === activeTab)?.component}
        </div>
      </div>
    </div>
  );
}

export default ConfigPage;
