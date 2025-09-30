import {
  fillTemplateVariables,
  getTemplateVariables,
  MCPServer,
  StdioMcpServer,
} from "@continuedev/config-yaml";
import { logger } from "../util/logger.js";

/**
 * Extracts secret variables from template strings, specifically looking for secrets.SECRET_NAME pattern
 */
export function getSecretVariables(templatedString: string): string[] {
  const variables = getTemplateVariables(templatedString);
  return variables
    .filter((v) => v.startsWith("secrets."))
    .map((v) => v.replace("secrets.", ""));
}

/**
 * Renders secrets from process.env for MCP server configurations
 */
export function renderSecretsFromEnv(templatedString: string): string {
  const secretVars = getSecretVariables(templatedString);
  const secretData: Record<string, string> = {};

  for (const secretName of secretVars) {
    const envValue = process.env[secretName];
    if (envValue !== undefined) {
      secretData[`secrets.${secretName}`] = envValue;
      logger.debug("Rendered secret from environment", { secretName });
    } else {
      logger.warn("Secret not found in environment", { secretName });
      // Keep the original template variable if not found
      secretData[`secrets.${secretName}`] = `\${{ secrets.${secretName} }}`;
    }
  }

  return fillTemplateVariables(templatedString, secretData);
}

/**
 * Renders secrets only in allowed fields of MCP server configuration
 */
function renderMcpServerSecretsSelectively(serverConfig: MCPServer): MCPServer {
  const result = { ...serverConfig };

  if ("command" in result) {
    // STDIO server - only render secrets in args and env
    const stdioConfig = result as StdioMcpServer;

    if (stdioConfig.args) {
      stdioConfig.args = stdioConfig.args.map((arg) =>
        typeof arg === "string" ? renderSecretsFromEnv(arg) : arg,
      );
    }

    if (stdioConfig.env) {
      const renderedEnv: Record<string, string> = {};
      for (const [key, value] of Object.entries(stdioConfig.env)) {
        renderedEnv[key] = renderSecretsFromEnv(value);
      }
      stdioConfig.env = renderedEnv;
    }
  } else {
    // SSE/HTTP server - only render secrets in url and headers
    const httpConfig = result;

    httpConfig.url = renderSecretsFromEnv(httpConfig.url);

    if (httpConfig.requestOptions?.headers) {
      const renderedHeaders: Record<string, string> = {};
      for (const [key, value] of Object.entries(
        httpConfig.requestOptions.headers,
      )) {
        renderedHeaders[key] = renderSecretsFromEnv(value);
      }
      httpConfig.requestOptions.headers = renderedHeaders;
    }
  }

  return result;
}

/**
 * Renders secrets in MCP server headers from process.env
 */
export function renderMcpServerHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!headers) {
    return headers;
  }

  const renderedHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    renderedHeaders[key] = renderSecretsFromEnv(value);
  }

  return renderedHeaders;
}

/**
 * Renders secrets in MCP server environment variables from process.env
 */
export function renderMcpServerEnv(
  env: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!env) {
    return env;
  }

  const renderedEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    renderedEnv[key] = renderSecretsFromEnv(value);
  }

  return renderedEnv;
}

/**
 * Renders secrets in allowed fields of an MCP server configuration from process.env
 */
export function renderMcpServerSecrets(serverConfig: MCPServer): MCPServer {
  const rendered = renderMcpServerSecretsSelectively(serverConfig);

  // Log which secrets were processed
  const allSecrets = new Set<string>();

  if ("command" in rendered) {
    // STDIO server - only check args and env
    const stdioConfig = rendered as StdioMcpServer;

    // Check args
    stdioConfig.args?.forEach((arg) => {
      getSecretVariables(arg).forEach((s) => allSecrets.add(s));
    });

    // Check env variables
    if (stdioConfig.env) {
      Object.values(stdioConfig.env).forEach((value) => {
        getSecretVariables(value).forEach((s) => allSecrets.add(s));
      });
    }
  } else {
    // SSE/HTTP server - only check URL and headers
    const httpConfig = rendered;

    // Check URL
    getSecretVariables(httpConfig.url).forEach((s) => allSecrets.add(s));

    // Check headers
    if (httpConfig.requestOptions?.headers) {
      Object.values(httpConfig.requestOptions.headers).forEach((value) => {
        getSecretVariables(value).forEach((s) => allSecrets.add(s));
      });
    }
  }

  if (allSecrets.size > 0) {
    logger.debug("Processed secrets for MCP server", {
      serverName: rendered.name,
      secretCount: allSecrets.size,
      secrets: Array.from(allSecrets),
    });
  }

  return rendered;
}

/**
 * Renders secrets for an array of MCP servers
 */
export function renderMcpServersSecrets(
  servers: MCPServer[] | undefined,
): MCPServer[] | undefined {
  if (!servers) {
    return servers;
  }

  return servers.map(renderMcpServerSecrets);
}

/**
 * Checks if a string contains any unrendered secrets
 */
export function hasUnrenderedSecrets(value: string): boolean {
  // Create a fresh regex to avoid global state issues
  const templateRegex = /\${{[\s]*([^}\s]+)[\s]*}}/g;
  return templateRegex.test(value) && getSecretVariables(value).length > 0;
}

/**
 * Validates that all secrets in allowed MCP server config fields have been rendered
 */
export function validateMcpServerSecretsRendered(serverConfig: MCPServer): {
  isValid: boolean;
  unrenderedSecrets: string[];
} {
  const unrenderedSecrets = new Set<string>();

  function checkValue(value: string) {
    if (hasUnrenderedSecrets(value)) {
      getSecretVariables(value).forEach((secret) =>
        unrenderedSecrets.add(secret),
      );
    }
  }

  if ("command" in serverConfig) {
    // STDIO server - only check args and env
    const stdioConfig = serverConfig as StdioMcpServer;

    stdioConfig.args?.forEach((arg) => {
      if (typeof arg === "string") {
        checkValue(arg);
      }
    });

    if (stdioConfig.env) {
      Object.values(stdioConfig.env).forEach((value) => {
        checkValue(value);
      });
    }
  } else {
    // SSE/HTTP server - only check URL and headers
    const httpConfig = serverConfig;

    checkValue(httpConfig.url);

    if (httpConfig.requestOptions?.headers) {
      Object.values(httpConfig.requestOptions.headers).forEach((value) => {
        checkValue(value);
      });
    }
  }

  return {
    isValid: unrenderedSecrets.size === 0,
    unrenderedSecrets: Array.from(unrenderedSecrets),
  };
}
