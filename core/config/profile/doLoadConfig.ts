import fs from "fs";

import {
  AssistantUnrolled,
  ConfigResult,
  ConfigValidationError,
  ModelRole,
  PackageIdentifier,
} from "@continuedev/config-yaml";

import {
  ContinueConfig,
  IDE,
  ILLMLogger,
  RuleWithSource,
  SerializedContinueConfig,
  SlashCommandDescWithSource,
  Tool,
} from "../../";
import { stringifyMcpPrompt } from "../../commands/slash/mcpSlashCommand";
import { convertRuleBlockToSlashCommand } from "../../commands/slash/ruleBlockSlashCommand";
import { MCPManagerSingleton } from "../../context/mcp/MCPManagerSingleton";
import ContinueProxyContextProvider from "../../context/providers/ContinueProxyContextProvider";
import MCPContextProvider from "../../context/providers/MCPContextProvider";
import { ControlPlaneProxyInfo } from "../../control-plane/analytics/IAnalyticsProvider.js";
import { ControlPlaneClient } from "../../control-plane/client.js";
import { getControlPlaneEnv } from "../../control-plane/env.js";
import { PolicySingleton } from "../../control-plane/PolicySingleton";
import { TeamAnalytics } from "../../control-plane/TeamAnalytics.js";
import ContinueProxy from "../../llm/llms/stubs/ContinueProxy";
import { initSlashCommand } from "../../promptFiles/initPrompt";
import { getConfigDependentToolDefinitions } from "../../tools";
import { encodeMCPToolUri } from "../../tools/callTool";
import { getMCPToolName } from "../../tools/mcpToolName";
import { GlobalContext } from "../../util/GlobalContext";
import { getConfigJsonPath, getConfigYamlPath } from "../../util/paths";
import { localPathOrUriToPath } from "../../util/pathToUri";
import { Telemetry } from "../../util/posthog";
import { SentryLogger } from "../../util/sentry/SentryLogger";
import { TTS } from "../../util/tts";
import { getWorkspaceContinueRuleDotFiles } from "../getWorkspaceContinueRuleDotFiles";
import { loadContinueConfigFromJson } from "../load";
import { CodebaseRulesCache } from "../markdown/loadCodebaseRules";
import { loadMarkdownRules } from "../markdown/loadMarkdownRules";
import { migrateJsonSharedConfig } from "../migrateSharedConfig";
import { rectifySelectedModelsFromGlobalContext } from "../selectedModels";
import { loadContinueConfigFromYaml } from "../yaml/loadYaml";

async function loadRules(ide: IDE) {
  const rules: RuleWithSource[] = [];
  const errors = [];

  // Add rules from .continuerules files
  const { rules: yamlRules, errors: continueRulesErrors } =
    await getWorkspaceContinueRuleDotFiles(ide);
  rules.unshift(...yamlRules);
  errors.push(...continueRulesErrors);

  // Add rules from markdown files in .continue/rules
  const { rules: markdownRules, errors: markdownRulesErrors } =
    await loadMarkdownRules(ide);
  rules.unshift(...markdownRules);
  errors.push(...markdownRulesErrors);

  // Add colocated rules from CodebaseRulesCache
  const codebaseRulesCache = CodebaseRulesCache.getInstance();
  rules.unshift(...codebaseRulesCache.rules);
  errors.push(...codebaseRulesCache.errors);

  return { rules, errors };
}

export default async function doLoadConfig(options: {
  ide: IDE;
  controlPlaneClient: ControlPlaneClient;
  llmLogger: ILLMLogger;
  overrideConfigJson?: SerializedContinueConfig;
  overrideConfigYaml?: AssistantUnrolled;
  profileId: string;
  overrideConfigYamlByPath?: string;
  orgScopeId: string | null;
  packageIdentifier: PackageIdentifier;
}): Promise<ConfigResult<ContinueConfig>> {
  const {
    ide,
    controlPlaneClient,
    llmLogger,
    overrideConfigJson,
    overrideConfigYaml,
    profileId,
    overrideConfigYamlByPath,
    orgScopeId,
    packageIdentifier,
  } = options;

  const ideInfo = await ide.getIdeInfo();
  const uniqueId = await ide.getUniqueId();
  const ideSettings = await ide.getIdeSettings();
  const workOsAccessToken = await controlPlaneClient.getAccessToken();
  const isSignedIn = await controlPlaneClient.isSignedIn();

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
    const result = await loadContinueConfigFromYaml({
      ide,
      ideSettings,
      ideInfo,
      uniqueId,
      llmLogger,
      overrideConfigYaml,
      controlPlaneClient,
      orgScopeId,
      packageIdentifier,
      workOsAccessToken,
    });
    newConfig = result.config;
    errors = result.errors;
    configLoadInterrupted = result.configLoadInterrupted;
  } else {
    const result = await loadContinueConfigFromJson(
      ide,
      ideSettings,
      ideInfo,
      uniqueId,
      llmLogger,
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

  // Load rules and always include the RulesContextProvider
  const { rules, errors: rulesErrors } = await loadRules(ide);
  errors.push(...rulesErrors);
  newConfig.rules.unshift(...rules);

  // Convert invokable rules to slash commands
  for (const rule of newConfig.rules) {
    if (rule.invokable) {
      try {
        const slashCommand = convertRuleBlockToSlashCommand(rule);
        (newConfig.slashCommands ??= []).push(slashCommand);
      } catch (e) {
        errors.push({
          message: `Error converting invokable rule ${rule.name} to slash command: ${e instanceof Error ? e.message : e}`,
          fatal: false,
        });
      }
    }
  }

  newConfig.slashCommands.push(initSlashCommand);

  const proxyContextProvider = newConfig.contextProviders?.find(
    (cp) => cp.description.title === "continue-proxy",
  );
  if (proxyContextProvider) {
    (proxyContextProvider as ContinueProxyContextProvider).workOsAccessToken =
      workOsAccessToken;
  }

  // Show deprecation warnings for providers
  const globalContext = new GlobalContext();
  newConfig.contextProviders.forEach((provider) => {
    if (provider.deprecationMessage) {
      const providerTitle = provider.description.title;
      const shownWarnings =
        globalContext.get("shownDeprecatedProviderWarnings") ?? {};
      if (!shownWarnings[providerTitle]) {
        void ide.showToast("warning", provider.deprecationMessage);
        globalContext.update("shownDeprecatedProviderWarnings", {
          ...shownWarnings,
          [providerTitle]: true,
        });
      }
    }
  });

  // Rectify model selections for each role
  newConfig = rectifySelectedModelsFromGlobalContext(newConfig, profileId);

  // Add things from MCP servers
  const mcpManager = MCPManagerSingleton.getInstance();
  const mcpServerStatuses = mcpManager.getStatuses();

  const serializableStatuses = mcpServerStatuses.map((server) => {
    const { client, ...rest } = server;
    return rest;
  });
  newConfig.mcpServerStatuses = serializableStatuses;

  for (const server of mcpServerStatuses) {
    server.errors.forEach((error) => {
      // MCP errors will also show as config loading errors
      errors.push({
        fatal: false,
        message: error,
      });
    });
    if (server.status === "connected") {
      const serverTools: Tool[] = server.tools.map((tool) => ({
        displayTitle: server.name + " " + tool.name,
        function: {
          description: tool.description,
          name: getMCPToolName(server, tool),
          parameters: tool.inputSchema,
        },
        faviconUrl: server.faviconUrl,
        readonly: false,
        type: "function" as const,
        uri: encodeMCPToolUri(server.id, tool.name),
        group: server.name,
        originalFunctionName: tool.name,
      }));
      newConfig.tools.push(...serverTools);

      // Fetch MCP prompt content during config load
      const serverSlashCommands: SlashCommandDescWithSource[] =
        await Promise.all(
          server.prompts.map(async (prompt) => {
            let promptContent: string | undefined;

            try {
              // Fetch the actual prompt content from the MCP server
              const mcpPromptResponse = await mcpManager.getPrompt(
                server.name,
                prompt.name,
                {}, // Empty args for now - TODO: handle prompt arguments
              );
              promptContent = stringifyMcpPrompt(mcpPromptResponse);
            } catch (error) {
              console.warn(
                `Failed to fetch MCP prompt content for ${prompt.name} from server ${server.name}:`,
                error,
              );
              // Keep promptContent as undefined so the UI can show a fallback
            }

            return {
              name: prompt.name,
              description: prompt.description ?? "MCP Prompt",
              source: "mcp-prompt",
              isLegacy: false,
              prompt: promptContent, // Store the actual prompt content
              mcpServerName: server.name, // Used in client to retrieve prompt
              mcpArgs: prompt.arguments,
            };
          }),
        );
      newConfig.slashCommands.push(...serverSlashCommands);

      const submenuItems = server.resources
        .map((resource) => ({
          title: resource.name,
          description: resource.description ?? resource.name,
          id: resource.uri,
          icon: server.faviconUrl,
        }))
        .concat(
          server.resourceTemplates.map((template) => ({
            title: template.name,
            description: template.description ?? template.name,
            id: template.uriTemplate,
            icon: server.faviconUrl,
          })),
        );
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

  newConfig.tools.push(
    ...(await getConfigDependentToolDefinitions({
      rules: newConfig.rules,
      enableExperimentalTools:
        newConfig.experimental?.enableExperimentalTools ?? false,
      isSignedIn,
      isRemote: await ide.isWorkspaceRemote(),
      modelName: newConfig.selectedModelByRole.chat?.model,
      ide,
    })),
  );

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

  const ruleCounts: Record<string, number> = {};
  newConfig.rules.forEach((rule) => {
    if (rule.name) {
      if (ruleCounts[rule.name]) {
        ruleCounts[rule.name] = ruleCounts[rule.name] + 1;
      } else {
        ruleCounts[rule.name] = 1;
      }
    }
  });

  Object.entries(ruleCounts).forEach(([ruleName, count]) => {
    if (count > 1) {
      errors!.push({
        fatal: false,
        message: `Duplicate (${count}) rules named "${ruleName}" detected. This may cause unexpected behavior`,
      });
    }
  });

  // VS Code has an IDE telemetry setting
  // Since it's a security concern we use OR behavior on false
  if (
    newConfig.allowAnonymousTelemetry !== false &&
    ideInfo.ideType === "vscode"
  ) {
    if ((await ide.isTelemetryEnabled()) === false) {
      newConfig.allowAnonymousTelemetry = false;
    }
  }

  // Org policies
  const policy = PolicySingleton.getInstance().policy?.policy;
  if (policy?.allowAnonymousTelemetry === false) {
    newConfig.allowAnonymousTelemetry = false;
  }
  if (policy?.allowCodebaseIndexing === false) {
    newConfig.disableIndexing = true;
  }

  // Setup telemetry only after (and if) we know it is enabled
  await Telemetry.setup(
    newConfig.allowAnonymousTelemetry ?? true,
    await ide.getUniqueId(),
    ideInfo,
  );

  // Setup Sentry logger with same telemetry settings
  // TODO: Remove Continue team member check once Sentry is ready for all users
  let userEmail: string | undefined;
  try {
    // Access the session info to get user email for Continue team member check
    const sessionInfo = await (controlPlaneClient as any).sessionInfoPromise;
    userEmail = sessionInfo?.account?.id;
  } catch (error) {
    // Ignore errors getting session info, will default to no Sentry
  }

  await SentryLogger.setup(
    newConfig.allowAnonymousTelemetry ?? false,
    await ide.getUniqueId(),
    ideInfo,
    userEmail,
  );

  // TODO: pass config to pre-load non-system TTS models
  await TTS.setup();

  // Set up control plane proxy if configured
  const controlPlane = (newConfig as any).controlPlane;
  const useOnPremProxy =
    controlPlane?.useContinueForTeamsProxy === false && controlPlane?.proxyUrl;

  const env = await getControlPlaneEnv(Promise.resolve(ideSettings));
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
    // FIXME before re-enabling TeamAnalytics.setup() populate workspaceId in
    //   controlPlaneProxyInfo to prevent /proxy/analytics/undefined/capture calls
    //   where undefined is :workspaceId
    // await TeamAnalytics.setup(
    //   newConfig.analytics,
    //   uniqueId,
    //   ideInfo.extensionVersion,
    //   controlPlaneClient,
    //   controlPlaneProxyInfo,
    // );
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

  config.modelsByRole.chat.forEach((model) => {
    if (model.providerName === "continue-proxy") {
      (model as ContinueProxy).controlPlaneProxyInfo = info;
    }
  });

  return config;
}
