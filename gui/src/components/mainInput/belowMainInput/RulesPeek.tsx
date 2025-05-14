import { DocumentTextIcon, GlobeAltIcon } from "@heroicons/react/24/outline";
import { RuleSource, RuleWithSource } from "core";
import { ComponentType, useMemo } from "react";
import ToggleDiv from "../../ToggleDiv";

interface RulesPeekProps {
  appliedRules?: RuleWithSource[];
  isCurrentRulesPeek: boolean;
  icon?: ComponentType<React.SVGProps<SVGSVGElement>>;
}

interface RulesPeekItemProps {
  rule: RuleWithSource;
}

// Convert technical source to user-friendly text
const getSourceLabel = (source: RuleSource): string => {
  switch (source) {
    case "default-chat":
      return "Default Chat";
    case "default-agent":
      return "Default Agent";
    case "model-chat-options":
      return "Model Chat Options";
    case "model-agent-options":
      return "Model Agent Options";
    case "rules-block":
      return "Rules Block";
    case "json-systemMessage":
      return "System Message";
    case ".continuerules":
      return "Project Rules";
    default:
      return source;
  }
};

export function RulesPeekItem({ rule }: RulesPeekItemProps) {
  const isGlobal = !rule.globs;

  return (
    <div
      className="group mr-2 flex flex-col overflow-hidden rounded px-1.5 py-1 text-xs hover:bg-white/10"
      data-testid="rules-peek-item"
    >
      <div className="flex w-full items-center">
        {isGlobal ? (
          <GlobeAltIcon className="mr-2 h-4 w-4 flex-shrink-0 text-gray-400" />
        ) : (
          <DocumentTextIcon className="mr-2 h-4 w-4 flex-shrink-0 text-gray-400" />
        )}

        <div className="flex min-w-0 flex-1 gap-2 text-xs">
          <div className="max-w-[50%] flex-shrink-0 truncate font-medium">
            {rule.name || "Assistant rule"}
          </div>

          <div className="min-w-0 flex-1 overflow-hidden truncate whitespace-nowrap text-xs text-gray-400">
            {isGlobal
              ? "Applies to all files"
              : `Pattern: ${typeof rule.globs === "string" ? rule.globs : Array.isArray(rule.globs) ? rule.globs.join(", ") : ""}`}
          </div>
        </div>
      </div>
      <div className="mt-1 whitespace-normal pl-6 pr-2 text-xs italic text-gray-300">
        {rule.rule}
      </div>
      <div className="mt-1 pl-6 pr-2 text-xs text-gray-500">
        Source: {getSourceLabel(rule.source)}
      </div>
    </div>
  );
}

export function RulesPeek({
  appliedRules,
  isCurrentRulesPeek,
  icon,
}: RulesPeekProps) {
  const rules = useMemo(() => {
    return appliedRules ?? [];
  }, [appliedRules]);

  if (!rules || rules.length === 0) {
    return null;
  }

  const globalRules = rules.filter((r) => !r.globs);
  const fileSpecificRules = rules.filter((r) => r.globs);

  return (
    <ToggleDiv
      icon={icon}
      title={`${rules.length} rule${rules.length > 1 ? "s" : ""}`}
    >
      {globalRules.length > 0 && (
        <div className="mb-1 ml-2 text-xs font-semibold text-gray-400">
          Global Rules
        </div>
      )}
      {globalRules.map((rule, idx) => (
        <RulesPeekItem key={`global-${idx}`} rule={rule} />
      ))}

      {fileSpecificRules.length > 0 && (
        <div className="mb-1 ml-2 mt-2 text-xs font-semibold text-gray-400">
          File-Specific Rules
        </div>
      )}
      {fileSpecificRules.map((rule, idx) => (
        <RulesPeekItem key={`file-${idx}`} rule={rule} />
      ))}
    </ToggleDiv>
  );
}
