import {
  BuildingOfficeIcon,
  CircleStackIcon,
  Cog6ToothIcon,
  CubeIcon,
  DocumentIcon,
  PencilIcon,
  QuestionMarkCircleIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { ConfigSection } from "./components/ConfigSection";
import { ConfigsSection } from "./sections/ConfigsSection";
import { HelpSection } from "./sections/HelpSection";
import { IndexingSettingsSection } from "./sections/IndexingSettingsSection";
import { ModelsSection } from "./sections/ModelsSection";
import { OrganizationsSection } from "./sections/OrganizationsSection";
import { RulesSection } from "./sections/RulesSection";
import { ToolsSection } from "./sections/ToolsSection";
import { UserSettingsSection } from "./sections/UserSettingsSection";

interface TabOption {
  id: string;
  label: string;
  component: React.ReactNode;
  icon: React.ReactNode;
  keywords?: string[];
  anchors?: ConfigAnchor[];
}

export interface ConfigAnchor {
  id: string;
  label: string;
  keywords?: string[];
}

export interface TabSection {
  id: string;
  label?: string;
  tabs: TabOption[];
  showTopDivider?: boolean;
  showBottomDivider?: boolean;
  className?: string;
}

export const topTabSections: TabSection[] = [
  {
    id: "general",
    label: "General",
    tabs: [
      {
        id: "settings",
        label: "General",
        keywords: [
          "settings",
          "general",
          "chat",
          "appearance",
          "telemetry",
          "autocomplete",
          "experimental",
        ],
        anchors: [
          {
            id: "conversation",
            label: "Conversation",
            keywords: ["chat", "session titles", "markdown", "tts"],
          },
          {
            id: "appearance",
            label: "Appearance",
            keywords: ["font size", "theme", "ui density"],
          },
          {
            id: "privacy-telemetry",
            label: "Privacy & Telemetry",
            keywords: ["telemetry", "privacy", "analytics"],
          },
          {
            id: "autocomplete",
            label: "Autocomplete",
            keywords: ["completions", "timeout", "debounce"],
          },
          {
            id: "experimental",
            label: "Experimental",
            keywords: ["current file", "experimental tools", "codebase"],
          },
        ],
        component: (
          <ConfigSection>
            <UserSettingsSection />
          </ConfigSection>
        ),
        icon: <Cog6ToothIcon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />,
      },
    ],
  },
  {
    id: "workspace",
    label: "Workspace",
    showTopDivider: true,
    tabs: [
      {
        id: "models",
        label: "Models",
        keywords: ["model", "models", "providers", "llm"],
        anchors: [
          {
            id: "primary-roles",
            label: "Primary roles",
            keywords: ["chat model", "autocomplete", "edit"],
          },
          {
            id: "additional-roles",
            label: "Additional roles",
            keywords: ["apply", "embed", "rerank"],
          },
        ],
        component: (
          <ConfigSection>
            <ModelsSection />
          </ConfigSection>
        ),
        icon: <CubeIcon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />,
      },
      {
        id: "rules",
        label: "Rules & Prompts",
        keywords: ["rules", "prompts", "slash commands", "instructions"],
        anchors: [
          {
            id: "rules-library",
            label: "Rules",
            keywords: ["instructions", "policy"],
          },
          {
            id: "prompts-library",
            label: "Prompts",
            keywords: ["slash commands", "commands", "prompt files"],
          },
        ],
        component: (
          <ConfigSection>
            <RulesSection />
          </ConfigSection>
        ),
        icon: <PencilIcon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />,
      },
      {
        id: "tools",
        label: "Tools & MCPs",
        keywords: ["tools", "mcp", "servers", "policies", "permissions"],
        anchors: [
          {
            id: "built-in-tools",
            label: "Built-in Tools",
            keywords: ["tool policies", "automatic", "ask first"],
          },
          {
            id: "mcp-servers",
            label: "MCP Servers",
            keywords: ["mcp", "resources", "prompts", "servers"],
          },
        ],
        component: (
          <ConfigSection>
            <ToolsSection />
          </ConfigSection>
        ),
        icon: (
          <WrenchScrewdriverIcon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />
        ),
      },
    ],
  },
  {
    id: "agents-orgs",
    showTopDivider: true,
    tabs: [
      {
        id: "configs",
        label: "Agents & Configs",
        keywords: ["agents", "configs", "profiles", "assistants"],
        anchors: [
          {
            id: "agent-configs",
            label: "Agent configs",
            keywords: ["profiles", "assistants", "workspace config"],
          },
        ],
        component: (
          <ConfigSection>
            <ConfigsSection />
          </ConfigSection>
        ),
        icon: <DocumentIcon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />,
      },
    ],
  },
  {
    id: "cloud",
    label: "Cloud & Teams",
    showTopDivider: true,
    tabs: [
      {
        id: "organizations",
        label: "Organizations",
        keywords: ["cloud", "teams", "organizations", "billing"],
        anchors: [
          {
            id: "organizations-overview",
            label: "Organizations",
            keywords: ["teams", "billing", "cloud agents"],
          },
        ],
        component: (
          <ConfigSection>
            <OrganizationsSection />
          </ConfigSection>
        ),
        icon: (
          <BuildingOfficeIcon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />
        ),
      },
    ],
  },
  {
    id: "indexing",
    label: "Knowledge",
    showTopDivider: true,
    tabs: [
      {
        id: "indexing",
        label: "Indexing & Docs",
        keywords: ["indexing", "docs", "embeddings", "retrieval", "codebase"],
        anchors: [
          {
            id: "indexing-overview",
            label: "Indexing overview",
            keywords: ["deprecation", "docs", "awareness"],
          },
          {
            id: "codebase-index",
            label: "Codebase index",
            keywords: ["index", "codebase", "progress"],
          },
        ],
        component: (
          <ConfigSection>
            <IndexingSettingsSection />
          </ConfigSection>
        ),
        icon: (
          <CircleStackIcon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />
        ),
      },
    ],
  },
];

export const bottomTabSections: TabSection[] = [
  {
    id: "support",
    label: "Support",
    tabs: [
      {
        id: "help",
        label: "Help & Docs",
        keywords: ["help", "docs", "documentation", "support", "faq"],
        anchors: [
          {
            id: "resources",
            label: "Resources",
            keywords: ["documentation", "community", "issues"],
          },
          {
            id: "help-tools",
            label: "Tools",
            keywords: ["token usage", "session history", "quickstart"],
          },
          {
            id: "keyboard-shortcuts",
            label: "Keyboard shortcuts",
            keywords: ["shortcuts", "keys", "commands"],
          },
        ],
        component: (
          <ConfigSection>
            <HelpSection />
          </ConfigSection>
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
