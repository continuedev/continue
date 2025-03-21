function ModelsSection() {
  return <div>Models content</div>;
}

function RulesSection() {
  return <div>Rules content</div>;
}

function DocsSection() {
  return <div>Docs content</div>;
}

function PromptsSection() {
  return <div>Prompts content</div>;
}

function ContextSection() {
  return <div>Context content</div>;
}

export function SelectedSection(props: { selectedSection: string | null }) {
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
