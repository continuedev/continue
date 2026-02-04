import { ConfigValidationError } from "@continuedev/config-yaml";
import { Tool, ToolOverride } from "..";

export interface ApplyToolOverridesResult {
  tools: Tool[];
  errors: ConfigValidationError[];
}

/**
 * Applies tool overrides from config to the list of tools.
 * Overrides can modify tool descriptions, display titles, action phrases,
 * system message descriptions, or disable tools entirely.
 */
export function applyToolOverrides(
  tools: Tool[],
  overrides: ToolOverride[] | undefined,
): ApplyToolOverridesResult {
  if (!overrides?.length) {
    return { tools, errors: [] };
  }

  const errors: ConfigValidationError[] = [];
  const toolsByName = new Map(tools.map((t) => [t.function.name, t]));

  for (const override of overrides) {
    const tool = toolsByName.get(override.name);

    if (!tool) {
      errors.push({
        fatal: false,
        message: `Tool override "${override.name}" does not match any known tool. Available tools: ${Array.from(toolsByName.keys()).join(", ")}`,
      });
      continue;
    }

    if (override.disabled) {
      toolsByName.delete(override.name);
      continue;
    }

    const updatedTool: Tool = {
      ...tool,
      function: {
        ...tool.function,
        description: override.description ?? tool.function.description,
      },
      displayTitle: override.displayTitle ?? tool.displayTitle,
      wouldLikeTo: override.wouldLikeTo ?? tool.wouldLikeTo,
      isCurrently: override.isCurrently ?? tool.isCurrently,
      hasAlready: override.hasAlready ?? tool.hasAlready,
    };

    if (override.systemMessageDescription) {
      updatedTool.systemMessageDescription = {
        prefix:
          override.systemMessageDescription.prefix ??
          tool.systemMessageDescription?.prefix ??
          "",
        exampleArgs:
          override.systemMessageDescription.exampleArgs ??
          tool.systemMessageDescription?.exampleArgs,
      };
    }

    toolsByName.set(override.name, updatedTool);
  }

  return { tools: Array.from(toolsByName.values()), errors };
}
