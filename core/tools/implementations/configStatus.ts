import type { ContinueConfig, ILLM, ToolExtras } from "../..";

import { getToolSessionId } from "../../util/sessionScopedStore";
import { listAgentTasks } from "../../util/taskStore";
import { getUnreadMailboxCounts } from "../../util/teamMailboxStore";
import { getActiveTeam } from "../../util/teamStore";
import { getPrimaryConfigFilePath } from "../../util/paths";
import { ToolImpl } from ".";

const SUPPORTED_SETTINGS = [
  "model",
  "available_models",
  "config_path",
  "mcp_servers",
] as const;

type ConfigSetting = (typeof SUPPORTED_SETTINGS)[number];

function requireText(value: unknown, fieldName: string): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    throw new Error(`${fieldName} is required`);
  }
  return trimmed;
}

function isConfigSetting(value: string): value is ConfigSetting {
  return SUPPORTED_SETTINGS.includes(value as ConfigSetting);
}

function formatModel(model: ILLM | null | undefined): string {
  if (!model) {
    return "none";
  }

  const provider = (model as any).provider ?? "unknown";
  const name =
    (model as any).title ??
    (model as any).model ??
    (model as any).name ??
    "unknown";
  return `${provider}/${name}`;
}

function formatSelectedModels(config: ContinueConfig): string {
  const lines = Object.entries(config.selectedModelByRole)
    .filter(([, model]) => Boolean(model))
    .map(([role, model]) => `${role}=${formatModel(model)}`);

  return lines.length > 0 ? lines.join("\n") : "No models selected.";
}

function formatAvailableModels(config: ContinueConfig): string {
  const lines = Object.entries(config.modelsByRole).flatMap(([role, models]) =>
    models.map((model, index) => `${role}[${index}]=${formatModel(model)}`),
  );

  return lines.length > 0 ? lines.join("\n") : "No models available.";
}

function formatMcpServers(config: ContinueConfig): string {
  if (config.mcpServerStatuses.length === 0) {
    return "No MCP servers configured.";
  }

  return config.mcpServerStatuses
    .map(
      (status) =>
        `${status.name}: ${status.status} (${status.tools.length} tools, ${status.prompts.length} prompts, ${status.resources.length} resources)`,
    )
    .join("\n");
}

async function formatTeamSummary(extras: ToolExtras): Promise<string> {
  const sessionId = getToolSessionId(extras);
  if (!sessionId) {
    return "Session team: unavailable (no session id)";
  }

  const team = await getActiveTeam(sessionId);
  if (!team) {
    return "Session team: none";
  }

  const unreadCounts = await getUnreadMailboxCounts(sessionId, team.teamName);
  const unreadTotal = Object.values(unreadCounts).reduce(
    (sum, count) => sum + count,
    0,
  );

  return `Session team: ${team.teamName} (${team.members.length} members, ${unreadTotal} unread mailbox items)`;
}

async function formatTaskSummary(extras: ToolExtras): Promise<string> {
  const sessionId = getToolSessionId(extras);
  if (!sessionId) {
    return "Tracked tasks: unavailable (no session id)";
  }

  const tasks = await listAgentTasks(sessionId);
  const activeCount = tasks.filter(
    (task) => task.status === "pending" || task.status === "in_progress",
  ).length;

  return `Tracked tasks: ${tasks.length} total (${activeCount} active)`;
}

export const configToolImpl: ToolImpl = async (args, extras) => {
  const setting = requireText(args?.setting, "setting").toLowerCase();
  if (!isConfigSetting(setting)) {
    throw new Error(
      `Unsupported setting: ${setting}. Supported settings: ${SUPPORTED_SETTINGS.join(", ")}.`,
    );
  }

  let content: string;
  switch (setting) {
    case "model":
      content = formatSelectedModels(extras.config);
      break;
    case "available_models":
      content = formatAvailableModels(extras.config);
      break;
    case "config_path":
      content = getPrimaryConfigFilePath();
      break;
    case "mcp_servers":
      content = formatMcpServers(extras.config);
      break;
  }

  return [
    {
      name: "Config",
      description: setting,
      content,
    },
  ];
};

export const statusToolImpl: ToolImpl = async (_args, extras) => {
  const ideInfo = await extras.ide.getIdeInfo();
  const mcpStatuses = extras.config.mcpServerStatuses;
  const connectedMcpCount = mcpStatuses.filter(
    (status) => status.status === "connected",
  ).length;

  const lines = [
    `IDE: ${ideInfo.name} ${ideInfo.version} (${ideInfo.remoteName || "local"})`,
    `Chat model: ${formatModel(extras.config.selectedModelByRole.chat)}`,
    `Subagent model: ${formatModel(extras.config.selectedModelByRole.subagent)}`,
    `Configured tools: ${extras.config.tools.length}`,
    `MCP servers: ${mcpStatuses.length} total (${connectedMcpCount} connected)`,
    await formatTaskSummary(extras),
    await formatTeamSummary(extras),
  ];

  return [
    {
      name: "Status",
      description: "Runtime status",
      content: lines.join("\n"),
    },
  ];
};
