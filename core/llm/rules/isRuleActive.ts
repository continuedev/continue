import { Rule } from "@continuedev/config-yaml";

const evaluateIf = (condition: string) => {
  return true;
};

export const isRuleActive = (rule: Rule): boolean => {
  if (typeof rule === "string") {
    return true;
  }

  if (rule.if) {
    return evaluateIf(rule.if);
  }

  return true;
};
