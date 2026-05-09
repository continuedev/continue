import {
  ArrowLeftIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { isOnPremSession } from "core/control-plane/AuthTypes";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AssistantAndOrgListbox } from "../../components/AssistantAndOrgListbox";
import { CliInstallBanner } from "../../components/CliInstallBanner";
import Alert from "../../components/gui/Alert";
import { Divider } from "../../components/ui/Divider";
import { TabGroup } from "../../components/ui/TabGroup";
import { useAuth } from "../../context/Auth";
import { useNavigationListener } from "../../hooks/useNavigationListener";
import {
  TabSection,
  bottomTabSections,
  getAllTabs,
  topTabSections,
} from "./configTabs";
import { AccountDropdown } from "./features/account/AccountDropdown";

function filterTabSections(sections: TabSection[], searchTerm: string) {
  const normalized = searchTerm.trim().toLowerCase();

  if (!normalized) {
    return sections;
  }

  return sections
    .map((section) => {
      const filteredTabs = section.tabs.filter((tab) => {
        const searchIndex = [
          tab.label,
          ...(tab.keywords ?? []),
          section.label ?? "",
        ]
          .join(" ")
          .toLowerCase();

        return searchIndex.includes(normalized);
      });

      return {
        ...section,
        tabs: filteredTabs,
      };
    })
    .filter((section) => section.tabs.length > 0);
}

function ConfigPage() {
  useNavigationListener();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const activeTab = searchParams.get("tab") || "settings";
  const { session, organizations } = useAuth();

  const allTabs = getAllTabs();
  const filteredTopTabSections = useMemo(
    () => filterTabSections(topTabSections, searchTerm),
    [searchTerm],
  );
  const filteredBottomTabSections = useMemo(
    () => filterTabSections(bottomTabSections, searchTerm),
    [searchTerm],
  );
  const hasMatches =
    filteredTopTabSections.length > 0 || filteredBottomTabSections.length > 0;
  const shouldRenderOrgInfo =
    session && organizations.length > 1 && !isOnPremSession(session);

  const handleTabClick = (tabId: string) => {
    navigate(`/config?tab=${tabId}`);
  };

  return (
    <div className="flex h-full flex-row overflow-hidden">
      <div className="bg-vsc-background border-r-border flex w-14 flex-shrink-0 flex-col border-b-0 border-l-0 border-r border-t-0 border-solid md:w-72">
        <div className="flex items-center gap-2 px-2 py-3 md:px-3">
          <button
            type="button"
            className="text-description hover:bg-vsc-input-background inline-flex h-8 w-8 items-center justify-center rounded-lg border-none bg-transparent p-0"
            onClick={() => navigate("/")}
            aria-label="Back to chat"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </button>
          <div className="hidden min-w-0 flex-1 md:block">
            <div className="truncate text-sm font-semibold">Settings</div>
            <div className="text-description-muted truncate text-xs">
              General, agents, tools, and workspace behavior
            </div>
          </div>
        </div>

        <div className="px-2 pb-2 md:px-3">
          <div className="bg-vsc-input-background/60 rounded-xl border border-solid border-transparent p-1">
            <AccountDropdown />
          </div>
        </div>

        {shouldRenderOrgInfo && (
          <div className="px-2 pb-2 md:px-3">
            <div className="bg-vsc-input-background/60 rounded-xl border border-solid border-transparent p-1">
              <AssistantAndOrgListbox variant="sidebar" />
            </div>
          </div>
        )}

        <div className="relative px-2 pb-3 md:px-3">
          <MagnifyingGlassIcon className="text-description-muted pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search settings"
            className="bg-vsc-input-background text-vsc-foreground focus:border-border w-full rounded-lg border border-solid border-transparent py-2 pl-9 pr-3 text-sm outline-none"
          />
        </div>

        <div className="border-r-border flex min-h-0 flex-1 flex-col overflow-hidden border-b-0 border-l-0 border-r-0 border-t border-solid px-2 pb-2 text-xs md:px-3">
          <div className="thin-scrollbar flex-1 overflow-y-auto pt-2">
            {filteredTopTabSections.map((section) => (
              <TabGroup
                key={section.id}
                tabs={section.tabs}
                activeTab={activeTab}
                onTabClick={handleTabClick}
                label={section.label}
                showTopDivider={section.showTopDivider}
                showBottomDivider={section.showBottomDivider}
                className={`mb-3 ${section.className ?? ""}`}
              />
            ))}

            {!hasMatches && (
              <div className="text-description-muted px-2 py-3 text-xs">
                No settings sections match "{searchTerm}".
              </div>
            )}
          </div>

          <div className="pt-2">
            {filteredBottomTabSections.map((section) => (
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
          </div>

          <Divider />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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

        <div className="thin-scrollbar relative hidden flex-1 overflow-y-auto sm:block">
          <div className="mx-auto w-full max-w-5xl space-y-8 px-6 py-6">
            {allTabs.find((tab) => tab.id === activeTab)?.component}
          </div>
          <CliInstallBanner permanentDismissal={true} />
        </div>
      </div>
    </div>
  );
}

export default ConfigPage;
