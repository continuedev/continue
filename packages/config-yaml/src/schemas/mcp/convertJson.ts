import type {
  HttpMcpServer,
  MCPServer,
  SseMcpServer,
  StdioMcpServer,
} from "./index.js";
import type {
  HttpMcpJsonConfig,
  McpJsonConfig,
  McpServersJsonConfigFile,
  SseMcpJsonConfig,
} from "./json.js";

/**
 * Convert environment variable references from JSON format (${VAR}) to YAML format (${{ secrets.VAR }})
 */
export function convertJsonEnvToYamlEnv(
  env: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!env) return undefined;

  return Object.fromEntries(
    Object.entries(env).map(([key, value]) => [
      key,
      value.replace(/\$\{([^}]+)\}/g, "${{ secrets.$1 }}"),
    ]),
  );
}

/**
 * Convert environment variable references from YAML format (${{ secrets.VAR }} or ${{ inputs.VAR }}) to JSON format (${VAR})
 */
export function convertYamlEnvToJsonEnv(
  env: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!env) return undefined;

  return Object.fromEntries(
    Object.entries(env).map(([key, value]) => [
      key,
      value.replace(/\$\{\{\s*(?:secrets|inputs)\.([^}\s]+)\s*\}\}/g, "${$1}"),
    ]),
  );
}

/**
 * Convert from JSON schema (used in Claude Desktop) to YAML schema (used in Continue)
 */
export function convertJsonMcpConfigToYamlMcpConfig(
  name: string,
  jsonConfig: McpJsonConfig,
): {
  yamlConfig: MCPServer;
  warnings: string[];
} {
  const warnings: string[] = [];

  // STDIO
  if ("command" in jsonConfig) {
    if (jsonConfig.envFile) {
      warnings.push(
        `envFile is not supported in Continue MCP configuration (server "${name}"). Environment variables from file will not be used.`,
      );
    }

    const stdioConfig: StdioMcpServer = {
      name,
      type: "stdio",
      command: jsonConfig.command,
      args: jsonConfig.args,
      env: convertJsonEnvToYamlEnv(jsonConfig.env),
    };
    return {
      warnings,
      yamlConfig: stdioConfig,
    };
  }

  // SSE/HTTP
  if ("url" in jsonConfig) {
    const sseOrHttpConfig: SseMcpServer | HttpMcpServer = {
      name,
      url: jsonConfig.url,
    };

    if (jsonConfig.type) {
      sseOrHttpConfig.type =
        jsonConfig.type === "http" ? "streamable-http" : "sse";
    }

    if (jsonConfig.headers) {
      sseOrHttpConfig.requestOptions = {
        headers: jsonConfig.headers,
      };
    }

    return {
      warnings,
      yamlConfig: sseOrHttpConfig,
    };
  }

  throw new Error(`Invalid MCP server configuration`);
}

/**
 * Convert from YAML schema (used in Continue) to JSON schema (e.g. used in Claude Desktop)
 */
export function convertYamlMcpConfigToJsonMcpConfig(yamlConfig: MCPServer): {
  name: string;
  jsonConfig: McpJsonConfig;
  MCP_TIMEOUT?: string;
  warnings: string[];
} {
  const { name, faviconUrl } = yamlConfig;

  const warnings: string[] = [];
  if (faviconUrl) {
    warnings.push(
      `\`faviconUrl\` from YAML MCP config not supported in Claude-style JSON, will be removed from server ${name}`,
    );
  }

  // Claude uses MCP_TIMEOUT env variable rather than a configuration for stdio
  const MCP_TIMEOUT = yamlConfig.connectionTimeout?.toString();

  // STDIO
  if ("command" in yamlConfig) {
    const { command, args, env, cwd } = yamlConfig;

    if (cwd) {
      warnings.push(
        `\`cwd\` from YAML MCP config not supported in Claude-style JSON, will be removed from server ${name}`,
      );
    }

    return {
      name,
      MCP_TIMEOUT,
      warnings,
      jsonConfig: {
        type: "stdio",
        command,
        args,
        env: convertYamlEnvToJsonEnv(env),
      },
    };
  }

  // SSE/HTTP
  if ("url" in yamlConfig) {
    const { url, requestOptions } = yamlConfig;

    const { headers, ...unsupportedReqOptions } = requestOptions ?? {};
    for (const key of Object.keys(unsupportedReqOptions)) {
      warnings.push(
        `${key} requestOption from YAML MCP config not supported in Claude-style JSON, will be ignored in server ${name}`,
      );
    }

    const httpOrSseJsonConfig: HttpMcpJsonConfig | SseMcpJsonConfig = {
      url,
      headers,
    };

    if (yamlConfig.type) {
      httpOrSseJsonConfig.type =
        yamlConfig.type === "streamable-http" ? "http" : "sse";
    }

    return {
      name,
      warnings,
      jsonConfig: httpOrSseJsonConfig,
      MCP_TIMEOUT,
    };
  }

  throw new Error(`Invalid MCP server configuration`);
}

export function converMcpServersJsonConfigFileToYamlBlocks(
  jsonFile: McpServersJsonConfigFile,
): {
  yamlConfigs: MCPServer[];
  warnings: string[];
} {
  const allWarnings: string[] = [];
  const jsonEntries = Object.entries(jsonFile.mcpServers ?? {});
  const yamlConfigs = jsonEntries.map(([name, config]) => {
    const { warnings, yamlConfig } = convertJsonMcpConfigToYamlMcpConfig(
      name,
      config,
    );
    allWarnings.push(...warnings);
    return yamlConfig;
  });

  return {
    warnings: allWarnings,
    yamlConfigs,
  };
}
