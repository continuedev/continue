import fs from "node:fs";

import {
  AssistantUnrolled,
  ConfigResult,
  ConfigValidationError,
  FQSN,
  isAssistantUnrolledNonNullable,
  ModelRole,
  PlatformClient,
  RegistryClient,
  SecretResult,
  unrollAssistantFromContent,
  validateConfigYaml,
} from "@continuedev/config-yaml";

import {
  ContinueConfig,
  IContextProvider,
  IDE,
  IdeInfo,
  IdeSettings,
  ILLMLogger,
} from "../..";
import { slashFromCustomCommand } from "../../commands";
import { MCPManagerSingleton } from "../../context/mcp";
import CodebaseContextProvider from "../../context/providers/CodebaseContextProvider";
import DocsContextProvider from "../../context/providers/DocsContextProvider";
import FileContextProvider from "../../context/providers/FileContextProvider";
import { contextProviderClassFromName } from "../../context/providers/index";
import { ControlPlaneClient } from "../../control-plane/client";
import FreeTrial from "../../llm/llms/FreeTrial";
import TransformersJsEmbeddingsProvider from "../../llm/llms/TransformersJsEmbeddingsProvider";
import { slashCommandFromPromptFileV1 } from "../../promptFiles/v1/slashCommandFromPromptFile";
import { getAllPromptFiles } from "../../promptFiles/v2/getPromptFiles";
import { allTools } from "../../tools";
import { GlobalContext } from "../../util/GlobalContext";
import { getConfigYamlPath } from "../../util/paths";
import { getSystemPromptDotFile } from "../getSystemPromptDotFile";
import { PlatformConfigMetadata } from "../profile/PlatformProfileLoader";
import { modifyAnyConfigWithSharedConfig } from "../sharedConfig";

import { getControlPlaneEnvSync } from "../../control-plane/env";
import { llmsFromModelConfig } from "./models";

export class LocalPlatformClient implements PlatformClient {
  constructor(
    private orgScopeId: string | null,
    private readonly client: ControlPlaneClient,
  ) {}

  async resolveFQSNs(fqsns: FQSN[]): Promise<(SecretResult | undefined)[]> {
    if (fqsns.length === 0) {
      return [];
    }

    const response = await this.client.resolveFQSNs(fqsns, this.orgScopeId);
    return response;
  }
}

async function loadConfigYaml(
  rawYaml: string,
  overrideConfigYaml: AssistantUnrolled | undefined,
  controlPlaneClient: ControlPlaneClient,
  orgScopeId: string | null,
  ideSettings: IdeSettings,
): Promise<ConfigResult<AssistantUnrolled>> {
  let config =
    overrideConfigYaml ??
    // This is how we allow use of blocks locally
    (await unrollAssistantFromContent(
      {
        ownerSlug: "",
        packageSlug: "",
        versionSlug: "",
      },
      rawYaml,
      new RegistryClient(
        await controlPlaneClient.getAccessToken(),
        getControlPlaneEnvSync(
          ideSettings.continueTestEnvironment,
          ideSettings.enableControlServerBeta,
        ).CONTROL_PLANE_URL,
      ),
      {
        currentUserSlug: "",
        onPremProxyUrl: null,
        orgScopeId,
        platformClient: new LocalPlatformClient(orgScopeId, controlPlaneClient),
        renderSecrets: true,
      },
    ));

  const errors = isAssistantUnrolledNonNullable(config)
    ? validateConfigYaml(config)
    : [
        {
          fatal: true,
          message: "Assistant includes blocks that don't exist",
        },
      ];

  if (errors?.some((error) => error.fatal)) {
    return {
      errors,
      config: undefined,
      configLoadInterrupted: true,
    };
  }

  // Set defaults if undefined (this lets us keep config.json uncluttered for new users)
  return {
    config,
    errors,
    configLoadInterrupted: false,
  };
}

async function configYamlToContinueConfig({
  config,
  ide,
  ideSettings,
  ideInfo,
  uniqueId,
  llmLogger,
  platformConfigMetadata,
  allowFreeTrial = true,
}: {
  config: AssistantUnrolled;
  ide: IDE;
  ideSettings: IdeSettings;
  ideInfo: IdeInfo;
  uniqueId: string;
  llmLogger: ILLMLogger;
  platformConfigMetadata: PlatformConfigMetadata | undefined;
  allowFreeTrial: boolean;
}): Promise<{ config: ContinueConfig; errors: ConfigValidationError[] }> {
  const localErrors: ConfigValidationError[] = [];

  const continueConfig: ContinueConfig = {
    slashCommands: [],
    tools: [...allTools],
    mcpServerStatuses: [],
    systemMessage: config.rules?.join("\n"),
    contextProviders: [],
    modelsByRole: {
      chat: [],
      edit: [],
      apply: [],
      embed: [],
      autocomplete: [],
      rerank: [],
      summarize: [],
    },
    selectedModelByRole: {
      chat: null,
      edit: null, // not currently used
      apply: null,
      embed: null,
      autocomplete: null,
      rerank: null,
      summarize: null,
    },
  };

  // Right now, if there are any missing packages in the config, then we will just throw an error
  if (!isAssistantUnrolledNonNullable(config)) {
    return {
      config: continueConfig,
      errors: [
        {
          message: "Found missing blocks in config.yaml",
          fatal: true,
        },
      ],
    };
  }

  continueConfig.data = config.data;
  continueConfig.rules = config.rules;
  continueConfig.docs = config.docs?.map((doc) => ({
    title: doc.name,
    startUrl: doc.startUrl,
    rootUrl: doc.rootUrl,
    faviconUrl: doc.faviconUrl,
  }));
  continueConfig.experimental = {
    modelContextProtocolServers: config.mcpServers?.map((mcpServer) => ({
      transport: {
        type: "stdio",
        command: mcpServer.command,
        args: mcpServer.args ?? [],
        env: mcpServer.env,
      },
    })),
  };

  // Prompt files -
  try {
    const promptFiles = await getAllPromptFiles(ide, undefined, true);

    for (const file of promptFiles) {
      try {
        const slashCommand = slashCommandFromPromptFileV1(
          file.path,
          file.content,
        );
        if (slashCommand) {
          continueConfig.slashCommands?.push(slashCommand);
        }
      } catch (e) {
        localErrors.push({
          fatal: false,
          message: `Failed to convert prompt file ${file.path} to slash command: ${e instanceof Error ? e.message : e}`,
        });
      }
    }
  } catch (e) {
    localErrors.push({
      fatal: false,
      message: `Error loading local prompt files: ${e instanceof Error ? e.message : e}`,
    });
  }

  config.prompts?.forEach((prompt) => {
    try {
      const slashCommand = slashFromCustomCommand(prompt);
      continueConfig.slashCommands?.push(slashCommand);
    } catch (e) {
      localErrors.push({
        message: `Error loading prompt ${prompt.name}: ${e instanceof Error ? e.message : e}`,
        fatal: false,
      });
    }
  });

  // Models
  const modelsArrayRoles: ModelRole[] = ["chat", "summarize", "apply", "edit"];
  for (const model of config.models ?? []) {
    model.roles = model.roles ?? modelsArrayRoles; // Default to all 4 chat-esque roles if not specified
    try {
      const llms = await llmsFromModelConfig({
        model,
        ide,
        uniqueId,
        ideSettings,
        llmLogger,
        platformConfigMetadata,
        config: continueConfig,
      });

      if (model.roles?.includes("chat")) {
        continueConfig.modelsByRole.chat.push(...llms);
      }

      if (model.roles?.includes("summarize")) {
        continueConfig.modelsByRole.summarize.push(...llms);
      }

      if (model.roles?.includes("apply")) {
        continueConfig.modelsByRole.apply.push(...llms);
      }

      if (model.roles?.includes("edit")) {
        continueConfig.modelsByRole.edit.push(...llms);
      }

      if (model.roles?.includes("autocomplete")) {
        continueConfig.modelsByRole.autocomplete.push(...llms);
      }

      if (model.roles?.includes("embed")) {
        const { provider } = model;
        if (provider === "transformers.js") {
          if (ideInfo.ideType === "vscode") {
            continueConfig.modelsByRole.embed.push(
              new TransformersJsEmbeddingsProvider(),
            );
          } else {
            localErrors.push({
              fatal: false,
              message: `Transformers.js embeddings provider not supported in this IDE.`,
            });
          }
        } else {
          continueConfig.modelsByRole.embed.push(...llms);
        }
      }

      if (model.roles?.includes("rerank")) {
        continueConfig.modelsByRole.rerank.push(...llms);
      }
    } catch (e) {
      localErrors.push({
        fatal: false,
        message: `Failed to load model:\nName: ${model.name}\nModel: ${model.model}\nProvider: ${model.provider}\n${e instanceof Error ? e.message : e}`,
      });
    }
  }

  // Add transformers js to the embed models in vs code if not already added
  if (
    ideInfo.ideType === "vscode" &&
    !continueConfig.modelsByRole.embed.find(
      (m) => m.providerName === "transformers.js",
    )
  ) {
    continueConfig.modelsByRole.embed.push(
      new TransformersJsEmbeddingsProvider(),
    );
  }

  if (allowFreeTrial) {
    // Obtain auth token (iff free trial being used)
    const freeTrialModels = continueConfig.modelsByRole.chat.filter(
      (model) => model.providerName === "free-trial",
    );
    if (freeTrialModels.length > 0) {
      try {
        const ghAuthToken = await ide.getGitHubAuthToken({});
        for (const model of freeTrialModels) {
          (model as FreeTrial).setupGhAuthToken(ghAuthToken);
        }
      } catch (e) {
        localErrors.push({
          fatal: false,
          message: `Failed to obtain GitHub auth token for free trial:\n${e instanceof Error ? e.message : e}`,
        });
        // Remove free trial models
        continueConfig.modelsByRole.chat =
          continueConfig.modelsByRole.chat.filter(
            (model) => model.providerName !== "free-trial",
          );
      }
    }
  } else {
    // Remove free trial models
    continueConfig.modelsByRole.chat = continueConfig.modelsByRole.chat.filter(
      (model) => model.providerName !== "free-trial",
    );
  }

  // Context providers
  const codebaseContextParams: IContextProvider[] =
    (config.context || []).find((cp) => cp.provider === "codebase")?.params ||
    {};
  const DEFAULT_CONTEXT_PROVIDERS = [
    new FileContextProvider({}),
    new CodebaseContextProvider(codebaseContextParams),
  ];

  const DEFAULT_CONTEXT_PROVIDERS_TITLES = DEFAULT_CONTEXT_PROVIDERS.map(
    ({ description: { title } }) => title,
  );

  continueConfig.contextProviders = (config.context
    ?.map((context) => {
      const cls = contextProviderClassFromName(context.provider) as any;
      if (!cls) {
        if (!DEFAULT_CONTEXT_PROVIDERS_TITLES.includes(context.provider)) {
          localErrors.push({
            fatal: false,
            message: `Unknown context provider ${context.provider}`,
          });
        }
        return undefined;
      }
      const instance: IContextProvider = new cls(context.params ?? {});
      return instance;
    })
    .filter((p) => !!p) ?? []) as IContextProvider[];
  continueConfig.contextProviders.push(...DEFAULT_CONTEXT_PROVIDERS);

  if (
    continueConfig.docs?.length &&
    !continueConfig.contextProviders?.some(
      (cp) => cp.description.title === "docs",
    )
  ) {
    continueConfig.contextProviders.push(new DocsContextProvider({}));
  }

  // Trigger MCP server refreshes (Config is reloaded again once connected!)
  const mcpManager = MCPManagerSingleton.getInstance();
  mcpManager.setConnections(
    (config.mcpServers ?? []).map((server) => ({
      id: server.name,
      name: server.name,
      transport: {
        type: "stdio",
        args: [],
        ...server,
      },
    })),
    false,
  );

  return { config: continueConfig, errors: localErrors };
}

export async function loadContinueConfigFromYaml({
  ide,
  ideSettings,
  ideInfo,
  uniqueId,
  llmLogger,
  // workOsAccessToken,
  overrideConfigYaml,
  platformConfigMetadata,
  controlPlaneClient,
  configYamlPath,
  orgScopeId,
}: {
  ide: IDE;
  ideSettings: IdeSettings;
  ideInfo: IdeInfo;
  uniqueId: string;
  llmLogger: ILLMLogger;
  // workOsAccessToken: string | undefined;
  overrideConfigYaml: AssistantUnrolled | undefined;
  platformConfigMetadata: PlatformConfigMetadata | undefined;
  controlPlaneClient: ControlPlaneClient;
  configYamlPath: string | undefined;
  orgScopeId: string | null;
}): Promise<ConfigResult<ContinueConfig>> {
  const rawYaml =
    overrideConfigYaml === undefined
      ? fs.readFileSync(
          configYamlPath ?? getConfigYamlPath(ideInfo.ideType),
          "utf-8",
        )
      : "";

  const configYamlResult = await loadConfigYaml(
    rawYaml,
    overrideConfigYaml,
    controlPlaneClient,
    orgScopeId,
    ideSettings,
  );

  if (!configYamlResult.config || configYamlResult.configLoadInterrupted) {
    return {
      errors: configYamlResult.errors,
      config: undefined,
      configLoadInterrupted: true,
    };
  }

  const { config: continueConfig, errors: localErrors } =
    await configYamlToContinueConfig({
      config: configYamlResult.config,
      ide,
      ideSettings,
      ideInfo,
      uniqueId,
      llmLogger,
      platformConfigMetadata,
      allowFreeTrial: true,
    });

  try {
    const systemPromptDotFile = await getSystemPromptDotFile(ide);
    if (systemPromptDotFile) {
      if (continueConfig.systemMessage) {
        continueConfig.systemMessage += "\n\n" + systemPromptDotFile;
      } else {
        continueConfig.systemMessage = systemPromptDotFile;
      }
    }
  } catch (e) {
    localErrors.push({
      fatal: false,
      message: `Failed to load system prompt dot file: ${e instanceof Error ? e.message : e}`,
    });
  }

  // Apply shared config
  // TODO: override several of these values with user/org shared config
  // Don't try catch this - has security implications and failure should be fatal
  const sharedConfig = new GlobalContext().getSharedConfig();
  const withShared = modifyAnyConfigWithSharedConfig(
    continueConfig,
    sharedConfig,
  );
  if (withShared.allowAnonymousTelemetry === undefined) {
    withShared.allowAnonymousTelemetry = true;
  }

  return {
    config: withShared,
    errors: [...(configYamlResult.errors ?? []), ...localErrors],
    configLoadInterrupted: false,
  };
}
