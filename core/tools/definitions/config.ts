import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

const SUPPORTED_SETTINGS = [
  "model",
  "available_models",
  "config_path",
  "mcp_servers",
] as const;

export const configTool: Tool = {
  type: "function",
  displayTitle: "Config",
  wouldLikeTo: "inspect runtime configuration",
  isCurrently: "inspecting runtime configuration",
  hasAlready: "inspected runtime configuration",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.Config,
    description:
      "Inspect selected runtime settings such as the current models, configured models by role, config file path, and MCP server statuses.",
    parameters: {
      type: "object",
      required: ["setting"],
      properties: {
        setting: {
          type: "string",
          description: `One of ${SUPPORTED_SETTINGS.join(", ")}.`,
          enum: [...SUPPORTED_SETTINGS],
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
};
