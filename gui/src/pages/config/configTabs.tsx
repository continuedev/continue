import {
  ArrowLeftIcon,
  ChatBubbleLeftRightIcon,
  CircleStackIcon,
  Cog6ToothIcon,
  CubeIcon,
  PencilIcon,
  QuestionMarkCircleIcon,
  Squares2X2Icon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { HelpSection } from "./sections/HelpSection";
import { IndexingSettingsSection } from "./sections/IndexingSettingsSection";
import { McpSection } from "./sections/McpSection";
import { ModelsSection } from "./sections/ModelsSection";
import { PromptsSection } from "./sections/PromptsSection";
import { RulesSection } from "./sections/RulesSection";
import { ToolPoliciesSection } from "./sections/ToolPoliciesSection";
import { UserSettingsSection } from "./sections/UserSettingsSection";

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
        id: "back",
        label: "Back",
        component: <div />,
        icon: <ArrowLeftIcon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />,
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
            <RulesSection />
          </div>
        ),
        icon: <PencilIcon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />,
      },
      {
        id: "prompts",
        label: "Prompts",
        component: (
          <div className="mt-4">
            <PromptsSection />
          </div>
        ),
        icon: (
          <ChatBubbleLeftRightIcon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />
        ),
      },
      {
        id: "mcp",
        label: "MCP",
        component: <McpSection />,
        icon: (
          <Squares2X2Icon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />
        ),
      },
      {
        id: "tools",
        label: "Tools",
        component: (
          <div className="mt-4">
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
        icon: (
          <CircleStackIcon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />
        ),
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
        component: <UserSettingsSection />,
        icon: <Cog6ToothIcon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />,
      },
      {
        id: "help",
        label: "Help",
        component: (
          <div className="mt-4">
            <HelpSection />
          </div>
        ),
        icon: (
          <QuestionMarkCircleIcon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />
        ),
      },
    ],
  },
];

export const getAllTabs = (): TabOption[] => {
  return [...topTabSections, ...bottomTabSections].flatMap(
    (section) => section.tabs,
  );
};
