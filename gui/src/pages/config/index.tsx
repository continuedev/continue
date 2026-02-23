import { isOnPremSession } from "core/control-plane/AuthTypes";
import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AssistantAndOrgListbox } from "../../components/AssistantAndOrgListbox";
import Alert from "../../components/gui/Alert";
import { Divider } from "../../components/ui/Divider";
import { TabGroup } from "../../components/ui/TabGroup";
import { useAuth } from "../../context/Auth";
import { useNavigationListener } from "../../hooks/useNavigationListener";
import { bottomTabSections, getAllTabs, topTabSections } from "./configTabs";
import { CliInstallBanner } from "../../components/CliInstallBanner";
import { AccountDropdown } from "./features/account/AccountDropdown";

function ConfigPage() {
  useNavigationListener();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "settings";
  const { session, organizations } = useAuth();

  const allTabs = getAllTabs();
  const shouldRenderOrgInfo =
    session && organizations.length > 1 && !isOnPremSession(session);

  const handleTabClick = (tabId: string) => {
    if (tabId === "back") {
      navigate("/");
    } else {
      navigate(`/config?tab=${tabId}`);
    }
  };

  return (
    <div className="flex h-full flex-row overflow-hidden">
      {/* Vertical Sidebar - full height */}
      <div className="bg-vsc-background flex w-12 flex-shrink-0 flex-col border-0 md:w-40">
        <div className="border-r-border flex flex-1 flex-col overflow-y-auto border-b-0 border-l-0 border-r-2 border-t-0 border-solid p-2 text-xs">
          {topTabSections.map((section, index) => (
            <React.Fragment key={section.id}>
              <TabGroup
                tabs={section.tabs}
                activeTab={activeTab}
                onTabClick={handleTabClick}
                showTopDivider={section.showTopDivider}
                showBottomDivider={section.showBottomDivider}
                className={section.className}
              />
              {index === 0 && shouldRenderOrgInfo && (
                <>
                  <Divider />
                  <AssistantAndOrgListbox variant="sidebar" />
                </>
              )}
            </React.Fragment>
          ))}

          <div className="flex-1" />

          {bottomTabSections.map((section) => (
            <TabGroup
              key={section.id}
              tabs={section.tabs}
              activeTab={activeTab}
              onTabClick={handleTabClick}
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
        {/* Alert for small screens (sm and below) */}
        <div className="block px-4 py-4 sm:hidden">
          <Alert type="warning" className="max-w-md">
            <div className="flex flex-col">
              <div className="font-medium">Screen width too small</div>
              <div className="text-description mt-1 text-sm">
                To view settings, please expand the sidebar by dragging the
                left/right border
              </div>
            </div>
          </Alert>
        </div>

        {/* Tab Content for larger screens (md and above) */}
        <div className="thin-scrollbar relative hidden flex-1 overflow-y-auto sm:block">
          <div className="space-y-6 px-4 py-4">
            {allTabs.find((tab) => tab.id === activeTab)?.component}
          </div>
          <CliInstallBanner permanentDismissal={true} />
        </div>
      </div>
    </div>
  );
}

export default ConfigPage;
