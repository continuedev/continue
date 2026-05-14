import { services } from "../services/index.js";

import { Tool } from "./types.js";

const SUPPORTED_SETTINGS = [
  "model",
  "available_models",
  "config_path",
  "mcp_servers",
] as const;

function formatCurrentModel(): string {
  const model = services.model.getModelInfo();
  if (!model) {
    return "No model selected.";
  }

  return `${model.provider}/${model.name}`;
}

export const configTool: Tool = {
  name: "Config",
  displayName: "Config",
  description:
    "Inspect selected runtime settings and switch the active chat model.",
  readonly: false,
  isBuiltIn: true,
  parameters: {
    type: "object",
    required: ["setting"],
    properties: {
      setting: {
        type: "string",
        description: `One of ${SUPPORTED_SETTINGS.join(", ")}.`,
      },
      value: {
        type: "string",
        description:
          "Optional new value. For model, pass either a model name or numeric index.",
      },
    },
  },
  run: async (args: { setting: string; value?: string }): Promise<string> => {
    const setting = args.setting.trim();

    switch (setting) {
      case "model": {
        if (args.value === undefined) {
          return `model=${formatCurrentModel()}`;
        }

        const parsedIndex = Number(args.value);
        const modelIndex = Number.isInteger(parsedIndex)
          ? parsedIndex
          : services.model.getModelIndexByName(args.value);

        if (modelIndex < 0) {
          return `Unknown model: ${args.value}`;
        }

        const state = await services.model.switchModel(modelIndex);
        const selected = state.model;
        return `model=${selected?.provider}/${(selected as any)?.name ?? (selected as any)?.model ?? "unknown"}`;
      }
      case "available_models": {
        const models = services.model.getAvailableChatModels();
        if (models.length === 0) {
          return "No chat models available.";
        }

        return models
          .map((model) => `${model.index}: ${model.provider}/${model.name}`)
          .join("\n");
      }
      case "config_path": {
        const state = services.config.getState();
        return state.configPath ?? "No config path loaded.";
      }
      case "mcp_servers": {
        const state = services.mcp.getState();
        if (state.connections.length === 0) {
          return "No MCP servers configured.";
        }

        return state.connections
          .map(
            (connection) =>
              `${connection.config.name}: ${connection.status} (${connection.tools.length} tools, ${connection.prompts.length} prompts)`,
          )
          .join("\n");
      }
      default:
        return `Unsupported setting: ${setting}`;
    }
  },
};
