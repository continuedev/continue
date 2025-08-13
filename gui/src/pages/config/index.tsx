import {
  BoltIcon,
  CircleStackIcon,
  Cog6ToothIcon,
  CubeIcon,
  PencilIcon,
  QuestionMarkCircleIcon,
  Squares2X2Icon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import MCPSection from "../../components/mainInput/Lump/sections/mcp/MCPSection";
import { ModelsSection } from "../../components/mainInput/Lump/sections/ModelsSection";
import { RulesSection } from "../../components/mainInput/Lump/sections/RulesSection";
import { ToolPoliciesSection } from "../../components/mainInput/Lump/sections/tool-policies/ToolPoliciesSection";
import { PageHeader } from "../../components/PageHeader";
import { useNavigationListener } from "../../hooks/useNavigationListener";
import { fontSize } from "../../util";
import { AccountButton } from "./AccountButton";
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
    // {
    //   id: "docs",
    //   label: "Docs",
    //   component: (
    //     <div className="mt-4">
    //       <h3 className="mb-4 mt-0 text-xl">Documentation</h3>
    //       <DocsSection />
    //     </div>
    //   ),
    //   icon: <BookOpenIcon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />,
    // },
    // {
    //   id: "prompts",
    //   label: "Prompts",
    //   component: (
    //     <div className="mt-4">
    //       <h3 className="mb-4 mt-0 text-xl">Prompts</h3>
    //       <PromptsSection />
    //     </div>
    //   ),
    //   icon: <ChatBubbleLeftIcon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />,
    // },
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
    <div className="flex h-full flex-col lg:flex-row lg:overflow-hidden">
      {/* Header and tabs section */}
      <div className="bg-vsc-background lg:bg-transparent lg:w-48 lg:flex-shrink-0 lg:flex lg:flex-col lg:h-full">
        {/* Header - only show on mobile/tablet */}
        <div className="lg:hidden">
          <PageHeader
            showBorder
            onTitleClick={() => navigate("/")}
            title="Chat"
            rightContent={<AccountButton />}
          />
        </div>

        {/* Tab Headers */}
        <div className="bg-vsc-input-background lg:bg-vsc-background flex cursor-pointer flex-wrap justify-center gap-x-2 gap-y-1 border-0 border-b-[1px] lg:border-r-[1px] lg:border-b-0 border-solid border-b-zinc-700 lg:border-r-zinc-700 p-0.5 lg:flex-col lg:gap-1 lg:p-4 lg:justify-start lg:flex-1 lg:overflow-y-auto">
          {tabs.map((tab) => (
            <div
              style={{
                fontSize: fontSize(-2),
              }}
              key={tab.id}
              className={`flex cursor-pointer items-center justify-center lg:justify-start gap-1.5 rounded-md px-2 py-2 hover:brightness-125 lg:w-full ${
                activeTab === tab.id ? "" : "text-gray-400"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </div>
          ))}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden lg:min-h-0">
        {/* Header for desktop */}
        <div className="hidden lg:block bg-vsc-background sticky top-0 z-10">
          <PageHeader
            showBorder
            onTitleClick={() => navigate("/")}
            title="Chat"
            rightContent={<AccountButton />}
          />
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto px-4 lg:overflow-y-auto">
          {tabs.find((tab) => tab.id === activeTab)?.component}
        </div>
      </div>
    </div>
  );
}

export default ConfigPage;
