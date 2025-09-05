import {
  ArrowLeftIcon,
  BoltIcon,
  CircleStackIcon,
  Cog6ToothIcon,
  CubeIcon,
  PencilIcon,
  QuestionMarkCircleIcon,
  Squares2X2Icon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { UserCircleIcon } from "@heroicons/react/24/solid";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { ToolTip } from "../../components/gui/Tooltip";
import MCPSection from "../../components/mainInput/Lump/sections/mcp/MCPSection";
import { ModelsSection } from "../../components/mainInput/Lump/sections/ModelsSection";
import { RulesSection } from "../../components/mainInput/Lump/sections/RulesSection";
import { ToolPoliciesSection } from "../../components/mainInput/Lump/sections/tool-policies/ToolPoliciesSection";
import { useNavigationListener } from "../../hooks/useNavigationListener";
import { fontSize } from "../../util";
import { AccountSection } from "./AccountSection";
import { HelpCenterSection } from "./HelpCenterSection";
import { IndexingSettingsSection } from "./IndexingSettingsSection";
import KeyboardShortcuts from "./KeyboardShortcuts";
import { UserSettingsForm } from "./UserSettingsForm";

type TabOption = {
  id: string;
  label: string;
  component: React.ReactNode;
  icon: React.ReactNode;
};

function ConfigPage() {
  useNavigationListener();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("settings");

  const tabs: TabOption[] = [
    {
      id: "account",
      label: "Account",
      component: <AccountSection />,
      icon: <UserCircleIcon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />,
    },
    {
      id: "settings",
      label: "Settings",
      component: <UserSettingsForm />,
      icon: <Cog6ToothIcon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />,
    },
    {
      id: "models",
      label: "Models",
      component: (
        <div className="mt-4">
          <h3 className="mb-4 mt-0 text-xl">Models</h3>
          <ModelsSection />
        </div>
      ),
      icon: <CubeIcon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />,
    },
    {
      id: "rules",
      label: "Rules",
      component: (
        <div className="mt-4">
          <h3 className="mb-4 mt-0 text-xl">Rules</h3>
          <RulesSection />
        </div>
      ),
      icon: <PencilIcon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />,
    },
    {
      id: "mcp",
      label: "MCP",
      component: <MCPSection />,
      icon: <Squares2X2Icon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />,
    },
    {
      id: "tools",
      label: "Tools",
      component: (
        <div className="mt-4">
          <h3 className="mb-4 mt-0 text-xl">Tool Policies</h3>
          <ToolPoliciesSection />
        </div>
      ),
      icon: (
        <WrenchScrewdriverIcon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />
      ),
    },
    {
      id: "indexing",
      label: "Indexing",
      component: <IndexingSettingsSection />,
      icon: <CircleStackIcon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />,
    },
    {
      id: "help",
      label: "Help",
      component: <HelpCenterSection />,
      icon: (
        <QuestionMarkCircleIcon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />
      ),
    },
    {
      id: "shortcuts",
      label: "Shortcuts",
      component: <KeyboardShortcuts />,
      icon: <BoltIcon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />,
    },
  ];

  return (
    <div className="flex h-full flex-row overflow-hidden">
      {/* Vertical Sidebar - full height */}
      <div className="bg-vsc-background flex w-12 flex-shrink-0 flex-col border-0 md:w-32">
        {/* Sidebar content */}
        <div className="border-r-border flex flex-1 flex-col gap-1 overflow-y-auto border-b-0 border-l-0 border-r-2 border-t-0 border-solid p-2">
          {/* Back Button */}
          <div
            className="-mx-1 flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-2 hover:brightness-125 md:justify-start"
            onClick={() => navigate("/")}
            data-tooltip-id="back-tooltip"
            style={{
              fontSize: fontSize(-2),
            }}
          >
            <ArrowLeftIcon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0 text-gray-400" />
            <span className="hidden text-gray-400 md:inline">Back</span>
          </div>

          {/* Back button tooltip for small screens only */}
          <ToolTip
            id="back-tooltip"
            place="right"
            offset={10}
            className="md:!hidden"
            style={{ fontSize: fontSize(-2) }}
          >
            Back
          </ToolTip>

          {/* Small gap between back button and tabs */}
          <div className="h-2"></div>

          {/* Tab Headers */}
          {tabs.map((tab) => {
            const tooltipId = `tab-tooltip-${uuidv4()}`;
            return (
              <div key={tab.id}>
                <div
                  style={{
                    fontSize: fontSize(-2),
                  }}
                  className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-md hover:brightness-125 md:justify-start ${
                    activeTab === tab.id
                      ? "bg-vsc-input-background p-2 md:px-2 md:py-2"
                      : "px-1 py-2 text-gray-400"
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                  data-tooltip-id={tooltipId}
                >
                  {tab.icon}
                  <span className="hidden md:inline">{tab.label}</span>
                </div>

                {/* Tooltip for small screens only */}
                <ToolTip
                  id={tooltipId}
                  place="right"
                  className="md:!hidden"
                  style={{ fontSize: fontSize(-2) }}
                >
                  {tab.label}
                </ToolTip>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto px-4">
          {tabs.find((tab) => tab.id === activeTab)?.component}
        </div>
      </div>
    </div>
  );
}

export default ConfigPage;
