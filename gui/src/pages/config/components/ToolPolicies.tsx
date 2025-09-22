import Alert from "../../../components/gui/Alert";
import { Card } from "../../../components/ui";
import { useToolPolicies } from "../hooks/useToolPolicies";
import { ToolPoliciesGroup } from "./ToolPoliciesGroup";

export function ToolPolicies() {
  const {
    mode,
    toolsByGroup,
    duplicateDetection,
    allToolsOff,
    message,
    expandedGroups,
    toggleGroup,
    toolGroupSettings,
  } = useToolPolicies();

  if (toolsByGroup.length === 0) {
    return (
      <Card>
        <span className="text-description text-sm italic">
          No tools available
        </span>
      </Card>
    );
  }

  return (
    <div>
      {(mode === "chat" || mode === "plan") && (
        <div className="mb-4">
          <Alert type="info" size="sm">
            <span className="text-2xs italic">{message}</span>
          </Alert>
        </div>
      )}

      <div className="space-y-4">
        {toolsByGroup.map(([groupName, tools]) => {
          const isGroupEnabled =
            !allToolsOff && toolGroupSettings[groupName] !== "exclude";
          const isExpanded = expandedGroups[groupName];

          return (
            <ToolPoliciesGroup
              key={groupName}
              groupName={groupName}
              tools={tools}
              isGroupEnabled={isGroupEnabled}
              isExpanded={isExpanded}
              allToolsOff={allToolsOff}
              duplicateDetection={duplicateDetection}
              onToggleGroup={toggleGroup}
            />
          );
        })}
      </div>
    </div>
  );
}
