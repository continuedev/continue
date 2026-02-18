import { DocumentTextIcon, GlobeAltIcon } from "@heroicons/react/24/outline";
import { RuleMetadata } from "core";
import { getRuleSourceDisplayName } from "core/llm/rules/rules-utils";
import { ComponentType, useMemo } from "react";
import ToggleDiv from "../../ToggleDiv";
import { useOpenRule } from "../Lump/useEditBlock";

interface RulesPeekProps {
  appliedRules?: RuleMetadata[];
  icon?: ComponentType<React.SVGProps<SVGSVGElement>>;
}

interface RulesPeekItemProps {
  rule: RuleMetadata;
}

export function RulesPeekItem({ rule }: RulesPeekItemProps) {
  const isGlobal = rule.alwaysApply ?? !rule.globs;
  const openRule = useOpenRule();

  return (
    <div
      className={`group mr-2 flex flex-col overflow-hidden rounded px-1.5 py-1 text-xs hover:bg-white/10`}
      data-testid="rules-peek-item"
      onClick={() => openRule(rule)}
    >
      <div className="flex w-full items-center">
        {isGlobal ? (
          <GlobeAltIcon className="text-description-muted mr-2 h-4 w-4 flex-shrink-0" />
        ) : (
          <DocumentTextIcon className="text-description-muted mr-2 h-4 w-4 flex-shrink-0" />
        )}

        <div className="flex min-w-0 flex-1 gap-2 text-xs">
          <div className="max-w-[50%] flex-shrink-0 truncate font-medium">
            {rule.name || "Agent rule"}
          </div>

          <div className="min-w-0 flex-1 overflow-hidden truncate whitespace-nowrap text-xs text-gray-500">
            {isGlobal
              ? "Always applied"
              : `Pattern: ${typeof rule.globs === "string" ? rule.globs : Array.isArray(rule.globs) ? rule.globs.join(", ") : ""}`}
          </div>
        </div>
      </div>
      <div className="mt-1 pl-6 pr-2 text-xs text-gray-500">
        Source: {getRuleSourceDisplayName(rule)}
      </div>
    </div>
  );
}

export function RulesPeek({ appliedRules, icon }: RulesPeekProps) {
  const rules = useMemo(() => {
    return appliedRules ?? [];
  }, [appliedRules]);

  if (!rules || rules.length === 0) {
    return null;
  }

  return (
    <ToggleDiv
      icon={icon}
      title={`${rules.length} rule${rules.length > 1 ? "s" : ""}`}
      testId="rules-peek"
    >
      {rules.map((rule, idx) => (
        <RulesPeekItem key={`rule-${idx}`} rule={rule} />
      ))}
    </ToggleDiv>
  );
}
