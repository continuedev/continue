import { Rule } from "@continuedev/config-yaml";
import { compileExpression } from "filtrex";
import { minimatch } from "minimatch";

const TEMPLATE_VAR_REGEX = /^\$\{\{(\s*.*?\s*)\}\}$/;

const createGlobFunction = (activePaths: string[]) => {
  return (pattern: string) => {
    const result = activePaths.some((path) => minimatch(path, pattern));
    return result;
  };
};

const contains = (str: string, searchStr: string): boolean => {
  return str.includes(searchStr);
};

const evaluateIf = ({
  condition,
  activePaths,
  currentModel,
}: {
  condition: string;
  activePaths: string[];
  currentModel: string;
}) => {
  const expression = condition.match(TEMPLATE_VAR_REGEX)?.[1]?.trim();
  if (!expression) {
    return true;
  }

  try {
    const evaluate = compileExpression(expression, {
      extraFunctions: {
        glob: createGlobFunction(activePaths),
        contains,
      },
      constants: {
        "current.model.model": currentModel,
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
  currentModel,
}: {
  rule: Rule;
  activePaths: string[];
  currentModel: string;
}): boolean => {
  if (typeof rule === "string") {
    return true;
  }

  if (rule.if) {
    return evaluateIf({ condition: rule.if, activePaths, currentModel });
  }

  return true;
};
