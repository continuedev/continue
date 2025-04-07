import fs from "fs";

import {
  AssistantUnrolled,
  ConfigResult,
  ConfigValidationError,
  ModelRole,
} from "@continuedev/config-yaml";

import {
  ContinueConfig,
  ContinueRcJson,
  IDE,
  IdeSettings,
  SerializedContinueConfig,
  Tool,
} from "../../";
import { constructMcpSlashCommand } from "../../commands/slash/mcp";
import { MCPManagerSingleton } from "../../context/mcp";
import MCPContextProvider from "../../context/providers/MCPContextProvider";
import { ControlPlaneProxyInfo } from "../../control-plane/analytics/IAnalyticsProvider.js";
import { ControlPlaneClient } from "../../control-plane/client.js";
import { getControlPlaneEnv } from "../../control-plane/env.js";
import { TeamAnalytics } from "../../control-plane/TeamAnalytics.js";
import ContinueProxy from "../../llm/llms/stubs/ContinueProxy";
import { encodeMCPToolUri } from "../../tools/callTool";
import { getConfigJsonPath, getConfigYamlPath } from "../../util/paths";
import { localPathOrUriToPath } from "../../util/pathToUri";
import { Telemetry } from "../../util/posthog";
import { TTS } from "../../util/tts";
import { loadContinueConfigFromJson } from "../load";
import { migrateJsonSharedConfig } from "../migrateSharedConfig";
import { rectifySelectedModelsFromGlobalContext } from "../selectedModels";
import { loadContinueConfigFromYaml } from "../yaml/loadYaml";

import { PlatformConfigMetadata } from "./PlatformProfileLoader";

export default async function doLoadConfig(
  ide: IDE,
  ideSettingsPromise: Promise<IdeSettings>,
  controlPlaneClient: ControlPlaneClient,
  writeLog: (message: string) => Promise<void>,
  overrideConfigJson: SerializedContinueConfig | undefined,
  overrideConfigYaml: AssistantUnrolled | undefined,
  platformConfigMetadata: PlatformConfigMetadata | undefined,
  profileId: string,
  overrideConfigYamlByPath: string | undefined,
  orgScopeId: string | null,
): Promise<ConfigResult<ContinueConfig>> {
  const workspaceConfigs = await getWorkspaceConfigs(ide);
  const ideInfo = await ide.getIdeInfo();
  const uniqueId = await ide.getUniqueId();
  const ideSettings = await ideSettingsPromise;
  const workOsAccessToken = await controlPlaneClient.getAccessToken();

  // Migrations for old config files
  // Removes
  const configJsonPath = getConfigJsonPath();
  if (fs.existsSync(configJsonPath)) {
    migrateJsonSharedConfig(configJsonPath, ide);
  }

  const configYamlPath = localPathOrUriToPath(
    overrideConfigYamlByPath || getConfigYamlPath(ideInfo.ideType),
  );

  let newConfig: ContinueConfig | undefined;
  let errors: ConfigValidationError[] | undefined;
  let configLoadInterrupted = false;

  if (overrideConfigYaml || fs.existsSync(configYamlPath)) {
    const result = await loadContinueConfigFromYaml(
      ide,
      ideSettings,
      ideInfo,
      uniqueId,
      writeLog,
      workOsAccessToken,
      overrideConfigYaml,
      platformConfigMetadata,
      controlPlaneClient,
      configYamlPath,
      orgScopeId,
    );
    newConfig = result.config;
    errors = result.errors;
    configLoadInterrupted = result.configLoadInterrupted;
  } else {
    const result = await loadContinueConfigFromJson(
      ide,
      workspaceConfigs,
      ideSettings,
      ideInfo,
      uniqueId,
      writeLog,
      workOsAccessToken,
      overrideConfigJson,
    );
    newConfig = result.config;
    errors = result.errors;
    configLoadInterrupted = result.configLoadInterrupted;
  }

  if (configLoadInterrupted || !newConfig) {
    return { errors, config: newConfig, configLoadInterrupted: true };
  }

  // TODO using config result but result with non-fatal errors is an antipattern?
  // Remove ability have undefined errors, just have an array
  errors = [...(errors ?? [])];

  // Rectify model selections for each role
  newConfig = rectifySelectedModelsFromGlobalContext(newConfig, profileId);

  // Add things from MCP servers
  const mcpManager = MCPManagerSingleton.getInstance();
  const mcpServerStatuses = mcpManager.getStatuses();

  // Slightly hacky just need connection's client to make slash command for now
  const serializableStatuses = mcpServerStatuses.map((server) => {
    const { client, ...rest } = server;
    return rest;
  });
  newConfig.mcpServerStatuses = serializableStatuses;

  for (const server of mcpServerStatuses) {
    if (server.status === "connected") {
      const serverTools: Tool[] = server.tools.map((tool) => ({
        displayTitle: server.name + " " + tool.name,
        function: {
          description: tool.description,
          name: tool.name,
          parameters: tool.inputSchema,
        },
        faviconUrl: server.faviconUrl,
        readonly: false,
        type: "function" as const,
        uri: encodeMCPToolUri(server.id, tool.name),
        group: server.name,
      }));
      newConfig.tools.push(...serverTools);

      const serverSlashCommands = server.prompts.map((prompt) =>
        constructMcpSlashCommand(
          server.client,
          prompt.name,
          prompt.description,
          prompt.arguments?.map((a: any) => a.name),
        ),
      );
      newConfig.slashCommands.push(...serverSlashCommands);

      const submenuItems = server.resources.map((resource) => ({
        title: resource.name,
        description: resource.description ?? resource.name,
        id: resource.uri,
        icon: server.faviconUrl,
      }));
      if (submenuItems.length > 0) {
        const serverContextProvider = new MCPContextProvider({
          submenuItems,
          mcpId: server.id,
          serverName: server.name,
        });
        newConfig.contextProviders.push(serverContextProvider);
      }
    }
  }

  // Detect duplicate tool names
  const counts: Record<string, number> = {};
  newConfig.tools.forEach((tool) => {
    if (counts[tool.function.name]) {
      counts[tool.function.name] = counts[tool.function.name] + 1;
    } else {
      counts[tool.function.name] = 1;
    }
  });
  Object.entries(counts).forEach(([toolName, count]) => {
    if (count > 1) {
      errors!.push({
        fatal: false,
        message: `Duplicate (${count}) tools named "${toolName}" detected. Permissions will conflict and usage may be unpredictable`,
      });
    }
  });

  newConfig.allowAnonymousTelemetry =
    newConfig.allowAnonymousTelemetry && (await ide.isTelemetryEnabled());

  // Setup telemetry only after (and if) we know it is enabled
  await Telemetry.setup(
    newConfig.allowAnonymousTelemetry ?? true,
    await ide.getUniqueId(),
    ideInfo,
  );

  // TODO: pass config to pre-load non-system TTS models
  await TTS.setup();

  // Set up control plane proxy if configured
  const controlPlane = (newConfig as any).controlPlane;
  const useOnPremProxy =
    controlPlane?.useContinueForTeamsProxy === false && controlPlane?.proxyUrl;

  const env = await getControlPlaneEnv(ideSettingsPromise);
  let controlPlaneProxyUrl: string = useOnPremProxy
    ? controlPlane?.proxyUrl
    : env.DEFAULT_CONTROL_PLANE_PROXY_URL;

  if (!controlPlaneProxyUrl.endsWith("/")) {
    controlPlaneProxyUrl += "/";
  }
  const controlPlaneProxyInfo = {
    profileId,
    controlPlaneProxyUrl,
    workOsAccessToken,
  };

  if (newConfig.analytics) {
    await TeamAnalytics.setup(
      newConfig.analytics,
      uniqueId,
      ideInfo.extensionVersion,
      controlPlaneClient,
      controlPlaneProxyInfo,
    );
  } else {
    await TeamAnalytics.shutdown();
  }

  newConfig = await injectControlPlaneProxyInfo(
    newConfig,
    controlPlaneProxyInfo,
  );

  return { config: newConfig, errors, configLoadInterrupted: false };
}

// Pass ControlPlaneProxyInfo to objects that need it
async function injectControlPlaneProxyInfo(
  config: ContinueConfig,
  info: ControlPlaneProxyInfo,
): Promise<ContinueConfig> {
  Object.keys(config.modelsByRole).forEach((key) => {
    config.modelsByRole[key as ModelRole].forEach((model) => {
      if (model.providerName === "continue-proxy") {
        (model as ContinueProxy).controlPlaneProxyInfo = info;
      }
    });
  });

  Object.keys(config.selectedModelByRole).forEach((key) => {
    const model = config.selectedModelByRole[key as ModelRole];
    if (model?.providerName === "continue-proxy") {
      (model as ContinueProxy).controlPlaneProxyInfo = info;
    }
  });

  config.models.forEach((model) => {
    if (model.providerName === "continue-proxy") {
      (model as ContinueProxy).controlPlaneProxyInfo = info;
    }
  });

  return config;
}

async function getWorkspaceConfigs(ide: IDE): Promise<ContinueRcJson[]> {
  const ideInfo = await ide.getIdeInfo();
  let workspaceConfigs: ContinueRcJson[] = [];

  try {
    workspaceConfigs = await ide.getWorkspaceConfigs();

    // Config is sent over the wire from JB so we need to parse it
    if (ideInfo.ideType === "jetbrains") {
      workspaceConfigs = (workspaceConfigs as any).map(JSON.parse);
    }
  } catch (e) {
    console.debug("Failed to load workspace configs: ", e);
  }

  return workspaceConfigs;
}
