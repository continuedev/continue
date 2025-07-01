import { DocumentTextIcon } from "@heroicons/react/24/outline";

export interface RuleTemplate {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  template: string;
}

export const ruleTemplates: RuleTemplate[] = [
  {
    icon: DocumentTextIcon,
    title: "Summarize learnings",
    template: "Lorem ipsum dolor est"
  }
];