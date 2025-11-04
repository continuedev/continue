import { RuleMetadata } from "../..";
import { getLastNPathParts } from "../../util/uri";

export function getRuleDisplayName(rule: RuleMetadata): string {
  if (rule.name) {
    return rule.name;
  }
  return getRuleSourceDisplayName(rule);
}

export function getRuleSourceDisplayName(rule: RuleMetadata): string {
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
    case "agentFile":
      if (rule.sourceFile) {
        return getLastNPathParts(rule.sourceFile, 2);
      } else {
        return "Agent file";
      }
    case "colocated-markdown":
      if (rule.sourceFile) {
        return getLastNPathParts(rule.sourceFile, 2);
      } else {
        return "rules.md";
      }
    case "rules-block":
      return "Rules Block";
    default:
      return rule.source;
  }
}
