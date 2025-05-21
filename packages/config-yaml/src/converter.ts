import { ConfigJson } from "@continuedev/config-types";
import { ConfigYaml } from "./schemas/index.js";
import { ModelRole } from "./schemas/models.js";

type ModelYaml = NonNullable<ConfigYaml["models"]>[number];
type ContextYaml = NonNullable<ConfigYaml["context"]>[number];
type PromptYaml = NonNullable<ConfigYaml["prompts"]>[number];

function convertModel(
  m: ConfigJson["models"][number],
  roles: ModelRole[],
): ModelYaml {
  return {
    name: m.title,
    provider: m.provider,
    model: m.model,
    apiKey: m.apiKey,
    apiBase: m.apiBase,
    roles,
    requestOptions: m.requestOptions,
    defaultCompletionOptions: m.completionOptions,
  };
}

function convertEmbeddingsProvider(
  m: NonNullable<ConfigJson["embeddingsProvider"]>,
): ModelYaml {
  return {
    name: "Embeddings Model",
    provider: m.provider,
    model: m.model ?? "",
    apiKey: m.apiKey,
    apiBase: m.apiBase,
    roles: ["embed"],
  };
}

function convertReranker(m: NonNullable<ConfigJson["reranker"]>): ModelYaml {
  return {
    name: "Reranker",
    provider: m.name,
    model: m.params?.model ?? "",
    apiKey: m.params?.apiKey,
    apiBase: m.params?.apiBase,
    roles: ["rerank"],
  };
}

function withFromContextProvider(
  contextProvider: NonNullable<ConfigJson["contextProviders"]>[number],
): Record<string, string> | undefined {
  const { name, params } = contextProvider;

  switch (name) {
    case "greptile":
      return {
        GITHUB_TOKEN: params?.GithubToken ?? "",
        GREPTILE_TOKEN: params?.GreptileToken ?? "",
      };
    case "jira":
      return {
        JIRA_TOKEN: params?.JiraToken ?? "",
        JIRA_API_VERSION: params?.JiraEmail,
        JIRA_DOMAIN: params?.JiraDomain ?? "",
      };
    case "postgres":
      return {
        POSTGRES_HOST: params?.host,
        POSTGRES_PORT: params?.port,
        POSTGRES_USER: params?.user,
        POSTGRES_PASSWORD: params?.password,
        POSTGRES_DATABASE: params?.database,
        POSTGRES_SCHEMA: params?.schema,
      };
    case "gitlab-mr":
      return {
        GITLAB_TOKEN: params?.token,
        DOMAIN: params?.domain,
      };
    case "discord":
      return {
        DISCORD_KEY: params?.discordKey,
        DISCORD_GUILD_ID: params?.guildId,
        DISCORD_CHANNELS: params?.channels,
      };
    case "commits":
      return {
        DEPTH: params?.Depth,
        LAST_N_COMMITS_DEPTH: params?.LastXCommitsDepth,
      };
    default:
      return undefined;
  }
}

function convertContext(configJson: ConfigJson): ContextYaml[] {
  const context: ContextYaml[] =
    configJson.contextProviders?.map((ctx) => {
      // ctx providers that weren't given official blocks
      if (
        ["web", "debugger", "issue", "database", "google", "http"].includes(
          ctx.name,
        )
      ) {
        return {
          provider: ctx.name,
          params: ctx.params,
        };
      }
      return {
        uses: `continuedev/${ctx.name === "open" ? "open-files" : ctx.name}-context`,
        with: ctx.params,
      };
    }) ?? [];

  return context;
}

function convertCustomCommand(
  cmd: NonNullable<ConfigJson["customCommands"]>[number],
): PromptYaml {
  return {
    name: cmd.name,
    description: cmd.description,
    prompt: (cmd as any).prompt, // The type is wrong in @continuedev/config-types
  };
}

function convertMcp(mcp: any): NonNullable<ConfigYaml["mcpServers"]>[number] {
  const { transport } = mcp;
  const { type } = transport;

  // Common properties for all server types
  const baseServer: any = {
    name: mcp.name,
    type: type,
  };

  if (mcp.faviconUrl) {
    baseServer.faviconUrl = mcp.faviconUrl
  }
  if (mcp.connectionTimeout) {
    baseServer.connectionTimeout = mcp.connectionTimeout
  }

  // Type-specific properties
  switch (type) {
    case "stdio":
      const stdioServer = {
        ...baseServer,
        command: transport.command,
      };

      if (transport.args) {
        stdioServer.args = transport.args
      }
      if (transport.env) {
        stdioServer.env = transport.env
      }

      return stdioServer;

    case "sse":
    case "websocket":
      return {
        ...baseServer,
        url: transport.url
      };

    default:
      throw new Error(`Unknown MCP server type: ${type}`);
  }
}

function convertDoc(
  doc: NonNullable<ConfigJson["docs"]>[number],
): NonNullable<ConfigYaml["docs"]>[number] {
  return {
    name: doc.title,
    startUrl: doc.startUrl,
    rootUrl: doc.rootUrl,
    faviconUrl: doc.faviconUrl,
  };
}

export function convertJsonToYamlConfig(configJson: ConfigJson): ConfigYaml {
  // models
  const models = configJson.models.map((m) => convertModel(m, ["chat"]));
  const autocompleteModels = Array.isArray(configJson.tabAutocompleteModel)
    ? configJson.tabAutocompleteModel
    : configJson.tabAutocompleteModel
      ? [configJson.tabAutocompleteModel]
      : [];
  models.push(
    ...autocompleteModels.map((m) => convertModel(m, ["autocomplete"])),
  );

  if (configJson.embeddingsProvider) {
    models.push(convertEmbeddingsProvider(configJson.embeddingsProvider));
  }

  if (configJson.reranker) {
    models.push(convertReranker(configJson.reranker));
  }

  // context
  const context = convertContext(configJson);

  // mcpServers
  // Types for "experimental" don't exist
  const mcpServers = (
    configJson as any
  ).experimental?.modelContextProtocolServers?.map(convertMcp);

  // prompts
  const prompts = configJson.customCommands?.map(convertCustomCommand);

  // docs
  const docs = configJson.docs?.map(convertDoc);

  const configYaml: ConfigYaml = {
    name: "Continue Config",
    version: "0.0.1",
    models,
    context,
    rules: configJson.systemMessage ? [configJson.systemMessage] : undefined,
    prompts,
    mcpServers,
    docs,
  };

  return configYaml;
}
