import { useLump } from "../LumpContext";
import { ContextSection } from "./ContextSection";
import DocsSection from "./docs/DocsSection";
import { ErrorSection } from "./errors/ErrorSection";
import MCPSection from "./mcp/MCPSection";
import { ModelsSection } from "./ModelsSection";
import { PromptsSection } from "./PromptsSection";
import { RulesSection } from "./RulesSection";
import { ToolPoliciesSection } from "./tool-policies/ToolPoliciesSection";

/**
 * Renders the appropriate section based on the selected section in the Lump context
 */
export function SelectedSection() {
  const { displayedSection } = useLump();

  switch (displayedSection) {
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
    case "tools":
      return <ToolPoliciesSection />;
    case "mcp":
      return <MCPSection />;
    case "error":
      return <ErrorSection />;
    default:
      return null;
  }
}
