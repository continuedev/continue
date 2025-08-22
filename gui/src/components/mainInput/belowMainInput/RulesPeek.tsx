import { DocumentTextIcon, GlobeAltIcon } from "@heroicons/react/24/outline";
import { AppliedRule } from "core";
import { getLastNPathParts } from "core/util/uri";
import { ComponentType, useContext, useMemo, useState } from "react";
import ToggleDiv from "../../ToggleDiv";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { DEFAULT_SYSTEM_MESSAGES_URL } from "core/llm/defaultSystemMessages";

interface RulesPeekProps {
  appliedRules?: AppliedRule[];
  icon?: ComponentType<React.SVGProps<SVGSVGElement>>;
}

interface RulesPeekItemProps {
  rule: AppliedRule;
}

// Convert technical source to user-friendly text
const getSourceLabel = (rule: AppliedRule): string => {
  switch (rule.source) {
    case "default-chat":
      return "Default Chat";
    case "default-agent":
      return "Default Agent";
    case "model-options-chat":
      return "Model Chat Options";
    case "model-options-plan":
      return "Model Plan Options";
    case "model-options-agent":
      return "Model Agent Options";
    case "rules-block":
      return "Rules Block";
    case "colocated-markdown":
      if (rule.ruleFile) {
        return getLastNPathParts(rule.ruleFile, 2);
      } else {
        return "rules.md";
      }
    case "json-systemMessage":
      return "System Message";
    case ".continuerules":
      return "Project Rules";
    default:
      return rule.source;
  }
};

export function RulesPeekItem({ rule }: RulesPeekItemProps) {
  const isGlobal = rule.alwaysApply ?? !rule.globs;

  const ideMessenger = useContext(IdeMessengerContext);
  const handleOpen = async () => {
    if (rule.slug) {
      void ideMessenger.request("controlPlane/openUrl", {
        path: `${rule.slug}/new-version`,
        orgSlug: undefined,
      });
    } else if (rule.ruleFile) {
      ideMessenger.post("openFile", {
        path: rule.ruleFile,
      });
    } else if (
      rule.source === "default-chat" ||
      rule.source === "default-plan" ||
      rule.source === "default-agent"
    ) {
      ideMessenger.post("openUrl", DEFAULT_SYSTEM_MESSAGES_URL);
    } else {
      ideMessenger.post("config/openProfile", {
        profileId: undefined,
        element: { sourceFile: (rule as any).sourceFile },
      });
    }
  };

  return (
    <div
      className={`group mr-2 flex flex-col overflow-hidden rounded px-1.5 py-1 text-xs hover:bg-white/10`}
      data-testid="rules-peek-item"
      onClick={handleOpen}
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
        Source: {getSourceLabel(rule)}
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
