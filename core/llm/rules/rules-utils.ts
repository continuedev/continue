import { RuleWithSource } from "../..";
import { getLastNPathParts } from "../../util/uri";

export function getRuleDisplayName(rule: RuleWithSource): string {
  if (rule.name) {
    return rule.name;
  }
  return getRuleSourceDisplayName(rule);
}

export function getRuleSourceDisplayName(rule: RuleWithSource): string {
  switch (rule.source) {
    case ".continuerules":
      return "Project rules";
    case "default-chat":
      return "Default chat system message";
    case "default-plan":
      return "Default plan mode system message";
    case "default-agent":
      return "Default agent system message";
    case "json-systemMessage":
      return "System Message (JSON)";
    case "model-options-agent":
      return "Base System Agent Message";
    case "model-options-plan":
      return "Base System Plan Message";
    case "model-options-chat":
      return "Base System Chat Message";
    case "agent-file":
      if (rule.ruleFile) {
        return getLastNPathParts(rule.ruleFile, 2);
      } else {
        return "Agent file";
      }
    case "colocated-markdown":
      if (rule.ruleFile) {
        return getLastNPathParts(rule.ruleFile, 2);
      } else {
        return "rules.md";
      }
    case "rules-block":
      return "Rules Block";
    default:
      return rule.source;
  }
}
