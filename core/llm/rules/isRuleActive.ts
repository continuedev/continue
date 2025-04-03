import { Rule } from "@continuedev/config-yaml";
import { compileExpression } from "filtrex";
import { minimatch } from "minimatch";

const TEMPLATE_VAR_REGEX = /^\$\{\{(\s*.*?\s*)\}\}$/;

const createGlobFunction = (activePaths: string[]) => {
  return (pattern: string) => {
    return activePaths.some((path) => minimatch(path, pattern));
  };
};

const evaluateIf = (condition: string, activePaths: string[]) => {
  const expression = condition.match(TEMPLATE_VAR_REGEX)?.[1]?.trim();
  if (!expression) {
    return true;
  }

  try {
    const evaluate = compileExpression(expression, {
      extraFunctions: {
        glob: createGlobFunction(activePaths),
      },
      constants: {
        current: {
          model: "gpt-4",
        },
      },
    });

    return evaluate({});
  } catch (error) {
    console.error("Error evaluating rule condition:", error);
    return false;
  }
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
    return evaluateIf(rule.if, activePaths);
  }

  return true;
};
