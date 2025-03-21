import React from 'react';
import { ModelsSection } from './ModelsSection';
import { RulesSection } from './RulesSection';
import { DocsSection } from './DocsSection';
import { PromptsSection } from './PromptsSection';
import { ContextSection } from './ContextSection';

interface SelectedSectionProps {
  selectedSection: string | null;
}

export function SelectedSection(props: SelectedSectionProps) {
  switch (props.selectedSection) {
    case "models":
      return <ModelsSection />;
    case "rules":
      return <RulesSection />;
    case "docs":
      return <DocsSection />;
    case "prompts":
      return <PromptsSection />;
    case "context":
      return <ContextSection />;
    default:
      return null;
  }
}