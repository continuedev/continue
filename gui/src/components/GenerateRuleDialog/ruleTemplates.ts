import {
  AtSymbolIcon,
  CodeBracketIcon,
  GlobeAltIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

export interface RuleTemplate {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  template: string;
}

export const ruleTemplates: RuleTemplate[] = [
  {
    icon: GlobeAltIcon,
    title: "Always Applied",
    template: "Create an always applied rule where for all files...",
  },
  {
    icon: CodeBracketIcon,
    title: "Auto attached",
    template:
      "Create an auto-attached rule where for all {FILE_EXTENSIONS} files...",
  },
  {
    icon: SparklesIcon,
    title: "Agent Requested",
    template: "Create an agent requested rule where...",
  },
  {
    icon: AtSymbolIcon,
    title: "Manual",
    template: "Create a manually requested rule where...",
  },
];
