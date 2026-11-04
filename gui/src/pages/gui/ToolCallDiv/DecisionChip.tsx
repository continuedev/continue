import type { ToolCallDecision } from "core";

/** The short words on the chip, by who decided. */
export function decisionLabel(d: ToolCallDecision): string {
  const cat = d.category ? ` [${d.category}]` : "";
  if (d.outcome === "allowed") {
    switch (d.source) {
      case "allow-rule":
        return "Allowed by rule";
      case "auto":
        return "Allowed by Auto";
      case "category":
        return "Allowed by switch";
      case "yolo":
        return "Allowed by YOLO";
      case "once":
        return "Allowed once by you";
      default:
        return "Allowed";
    }
  }
  switch (d.source) {
    case "deny-rule":
      return "Blocked by rule";
    case "auto":
      return `Blocked by Auto${cat}`;
    case "tool-setting":
      return "Tool turned off";
    default:
      return "Blocked by safety check";
  }
}

/**
 * Why a tool call ran without asking, or was refused: a rule, a switch, YOLO,
 * or the Auto reviewer's reason. The full sentence is in the tooltip.
 */
export function DecisionChip({
  decision,
}: {
  decision: ToolCallDecision | undefined;
}) {
  if (!decision) return null;
  const blocked = decision.outcome === "blocked";
  const detail = [decision.reason, decision.rule && `Rule: ${decision.rule}`]
    .filter(Boolean)
    .join("\n");
  return (
    <span
      data-testid="decision-chip"
      data-outcome={decision.outcome}
      title={detail || undefined}
      className={`flex-shrink-0 whitespace-nowrap rounded-full px-1.5 text-2xs ${
        blocked ? "bg-error/20 text-error" : "bg-lightgray/20 text-description"
      }`}
    >
      {decisionLabel(decision)}
    </span>
  );
}
