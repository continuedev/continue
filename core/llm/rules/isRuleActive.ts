import { Rule } from "@continuedev/config-yaml";

const TEMPLATE_VAR_REGEX = /^\$\{\{(\s*.*?\s*)\}\}$/;

const evaluateIf = (condition: string) => {
  debugger;

  const expression = condition.match(TEMPLATE_VAR_REGEX)?.[1]?.trim();

  if (!expression) {
    return false;
  }

  return true;
};
export const isRuleActive = ({
  rule,
  activePaths,
}: {
  rule: Rule;
  activePaths: string[];
}): boolean => {
  if (typeof rule === "string") {
    return true;
  }

  if (rule.if) {
    return evaluateIf(rule.if);
  }

  return true;
};
