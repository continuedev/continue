import {
  CircleStackIcon,
  Cog6ToothIcon,
  CubeIcon,
  PencilIcon,
  QuestionMarkCircleIcon,
  Squares2X2Icon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { UserCircleIcon } from "@heroicons/react/24/solid";
import MCPSection from "../../components/mainInput/Lump/sections/mcp/MCPSection";
import { ModelsSection } from "../../components/mainInput/Lump/sections/ModelsSection";
import { RulesSection } from "../../components/mainInput/Lump/sections/RulesSection";
import { ToolPoliciesSection } from "../../components/mainInput/Lump/sections/tool-policies/ToolPoliciesSection";
import { AccountSection } from "./AccountSection";
import { HelpCenterSection } from "./HelpCenterSection";
import { IndexingSettingsSection } from "./IndexingSettingsSection";
import { UserSettingsForm } from "./UserSettingsForm";

interface TabOption {
  id: string;
  label: string;
  component: React.ReactNode;
  icon: React.ReactNode;
}

interface TabSection {
  id: string;
  tabs: TabOption[];
  label?: string;
  showTopDivider?: boolean;
  showBottomDivider?: boolean;
  className?: string;
}

export const topTabSections: TabSection[] = [
  {
    id: "top",
    tabs: [
      {
        id: "account",
        label: "Account",
        component: <AccountSection />,
        icon: <UserCircleIcon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />,
      },
    ],
  },
  {
    id: "blocks",
    label: "Blocks",
    showTopDivider: true,
    tabs: [
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
    ],
  },
  {
    id: "indexing",
    showTopDivider: true,
    tabs: [
      {
        id: "indexing",
        label: "Indexing",
        component: <IndexingSettingsSection />,
        icon: <CircleStackIcon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />,
      },
    ],
  },
];

export const bottomTabSections: TabSection[] = [
  {
    id: "bottom",
    tabs: [
      {
        id: "settings",
        label: "Settings",
        component: <UserSettingsForm />,
        icon: <Cog6ToothIcon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />,
      },
      {
        id: "help",
        label: "Help",
        component: <HelpCenterSection />,
        icon: (
          <QuestionMarkCircleIcon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />
        ),
      },
    ],
  },
];

export const getAllTabs = (): TabOption[] => {
  return [...topTabSections, ...bottomTabSections].flatMap((section) => section.tabs);
};