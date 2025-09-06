import { useNavigate } from "react-router-dom";
import { useLump } from "../LumpContext";
import { ContextSection } from "./ContextSection";
import { ErrorSection } from "./errors/ErrorSection";

/**
 * Renders the appropriate section based on the selected section in the Lump context
 */
export function SelectedSection() {
  const { displayedSection, hideLump } = useLump();
  const navigate = useNavigate();

  const handleConfigRedirect = (tabId: string) => {
    hideLump();
    navigate(`/config?tab=${tabId}`);
  };

  switch (displayedSection) {
    case "models":
      handleConfigRedirect("models");
      return null;
    case "rules":
      handleConfigRedirect("rules");
      return null;
    case "prompts":
      handleConfigRedirect("prompts");
      return null;
    case "tools":
      handleConfigRedirect("tools");
      return null;
    case "mcp":
      handleConfigRedirect("mcp");
      return null;
    case "context":
      return <ContextSection />;
    case "error":
      return <ErrorSection />;
    default:
      return null;
  }
}
