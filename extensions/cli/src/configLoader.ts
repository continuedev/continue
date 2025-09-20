import * as fs from "fs";
import { dirname } from "node:path";
import * as path from "path";

import {
  AssistantUnrolled,
  PackageIdentifier,
  RegistryClient,
  unrollAssistant,
} from "@continuedev/config-yaml";
import { DefaultApiInterface } from "@continuedev/sdk/dist/api/dist/index.js";
import chalk from "chalk";

import { uriToPath, uriToSlug } from "./auth/uriUtils.js";
import {
  AuthConfig,
  getAccessToken,
  getConfigUri,
  getOrganizationId,
  isEnvironmentAuthConfig,
  loadAuthConfig,
  updateConfigUri,
} from "./auth/workos.js";
import { CLIPlatformClient } from "./CLIPlatformClient.js";
import { env } from "./env.js";

export interface ConfigLoadResult {
  config: AssistantUnrolled;
  source: ConfigSource;
}

export type ConfigSource =
  | { type: "cli-flag"; path: string }
  | { type: "saved-uri"; uri: string }
  | { type: "user-assistant"; slug: string }
  | { type: "default-config-yaml" }
  | { type: "default-agent" };

/**
 * Streamlined configuration loader that implements the specification
 * with clear precedence and fallback logic in a single testable function.
 */
export async function loadConfiguration(
  authConfig: AuthConfig,
  cliConfigPath: string | undefined,
  apiClient: DefaultApiInterface,
): Promise<ConfigLoadResult> {
  const organizationId = getOrganizationId(authConfig);
  const accessToken = getAccessToken(authConfig);

  // Step 1: Determine config source using precedence rules
  const configSource = determineConfigSource(authConfig, cliConfigPath);

  // Step 2: Load configuration from the determined source
  const config = await loadFromSource(
    configSource,
    accessToken,
    organizationId ?? null,
    apiClient,
  );

  // Step 3: Save config URI for session continuity (only for file-based auth)
  if (!isEnvironmentAuthConfig(authConfig) && authConfig !== null) {
    const uri = getUriFromSource(configSource);
    if (uri) {
      updateConfigUri(uri);
    }
  }

  return { config, source: configSource };
}

/**
 * Determines the configuration source using the specification's precedence rules:
 * 1. CLI --config flag (highest priority)
 * 2. Saved config URI (if no CLI flag)
 * 3. Default resolution (if no flag and no saved URI)
 */
function determineConfigSource(
  authConfig: AuthConfig,
  cliConfigPath: string | undefined,
): ConfigSource {
  // Priority 1: CLI --config flag
  if (cliConfigPath) {
    return { type: "cli-flag", path: cliConfigPath };
  }

  // Priority 2: Saved config URI (only for file-based auth)
  if (!isEnvironmentAuthConfig(authConfig) && authConfig !== null) {
    const savedUri = getConfigUri(authConfig);
    if (savedUri) {
      return { type: "saved-uri", uri: savedUri };
    }
  }

  // Priority 3: Default resolution based on auth state
  if (authConfig === null) {
    // Unauthenticated: check for default config.yaml, then fallback to default agent
    const defaultConfigPath = path.join(env.continueHome, "config.yaml");
    if (fs.existsSync(defaultConfigPath)) {
      return { type: "default-config-yaml" };
    }
    return { type: "default-agent" };
  } else {
    // Authenticated: try user assistants first
    return { type: "user-assistant", slug: "" }; // Empty slug means "first available"
  }
}

/**
 * Loads configuration from the determined source with appropriate error handling
 */
async function loadFromSource(
  source: ConfigSource,
  accessToken: string | null,
  organizationId: string | null,
  apiClient: DefaultApiInterface,
): Promise<AssistantUnrolled> {
  try {
    switch (source.type) {
      case "cli-flag":
        return await loadFromCliFlag(
          source.path,
          accessToken,
          organizationId,
          apiClient,
        );

      case "saved-uri":
        return await loadFromSavedUri(
          source.uri,
          accessToken,
          organizationId,
          apiClient,
        );

      case "user-assistant":
        return await loadUserAssistantWithFallback(organizationId, apiClient);

      case "default-config-yaml":
        return await loadDefaultConfigYaml(
          accessToken,
          organizationId,
          apiClient,
        );

      case "default-agent":
        return await loadDefaultAgent(organizationId, apiClient);

      default:
        throw new Error(`Unknown config source type: ${(source as any).type}`);
    }
  } catch (error) {
    // If we're trying user assistants and it fails, fall back to default agent
    if (source.type === "user-assistant") {
      console.warn(
        chalk.yellow(
          "Failed to load user assistants, falling back to default agent",
        ),
      );
      return await loadDefaultAgent(organizationId, apiClient);
    }
    throw error;
  }
}

/**
 * Loads configuration from CLI --config flag
 * Supports both file paths and assistant slugs
 */
async function loadFromCliFlag(
  configPath: string,
  accessToken: string | null,
  organizationId: string | null,
  apiClient: DefaultApiInterface,
): Promise<AssistantUnrolled> {
  if (isFilePath(configPath)) {
    // Load local YAML file
    return await loadConfigYaml(
      configPath,
      accessToken,
      organizationId,
      apiClient,
    );
  } else {
    // Load assistant slug
    return await loadAssistantSlug(configPath, organizationId, apiClient);
  }
}

/**
 * Loads configuration from saved URI in auth config
 */
async function loadFromSavedUri(
  uri: string,
  accessToken: string | null,
  organizationId: string | null,
  apiClient: DefaultApiInterface,
): Promise<AssistantUnrolled> {
  const filePath = uriToPath(uri);
  if (filePath) {
    return await loadConfigYaml(
      filePath,
      accessToken,
      organizationId,
      apiClient,
    );
  }

  const slug = uriToSlug(uri);
  if (slug) {
    return await loadAssistantSlug(slug, organizationId, apiClient);
  }

  throw new Error(`Invalid saved config URI: ${uri}`);
}

/**
 * Loads first available user assistant with fallback to default agent
 */
async function loadUserAssistantWithFallback(
  organizationId: string | null,
  apiClient: DefaultApiInterface,
): Promise<AssistantUnrolled> {
  const assistants = await apiClient.listAssistants({
    alwaysUseProxy: "false",
    organizationId: organizationId ?? undefined,
  });

  if (assistants.length > 0) {
    const result = assistants[0].configResult;
    if (!result.config) {
      throw new Error(result.errors?.join("\n") ?? "Failed to load assistant.");
    }

    const errors = result.errors;
    if (errors?.some((e: any) => e.fatal)) {
      throw new Error(
        errors.map((e: any) => e.message).join("\n") ??
          "Failed to load assistant.",
      );
    }

    return result.config as AssistantUnrolled;
  }

  // No user assistants, fall back to default agent
  return await loadDefaultAgent(organizationId, apiClient);
}

/**
 * Loads default config.yaml from ~/.continue/config.yaml
 */
async function loadDefaultConfigYaml(
  accessToken: string | null,
  organizationId: string | null,
  apiClient: DefaultApiInterface,
): Promise<AssistantUnrolled> {
  const defaultConfigPath = path.join(env.continueHome, "config.yaml");
  return await loadConfigYaml(
    defaultConfigPath,
    accessToken,
    organizationId,
    apiClient,
  );
}

/**
 * Loads the default continuedev/default-agent
 */
async function loadDefaultAgent(
  organizationId: string | null,
  apiClient: DefaultApiInterface,
): Promise<AssistantUnrolled> {
  const resp = await apiClient.getAssistant({
    ownerSlug: "continuedev",
    packageSlug: "default-agent",
    organizationId: organizationId ?? undefined,
  });

  if (!resp.configResult.config) {
    throw new Error("Failed to load default agent.");
  }

  return resp.configResult.config as AssistantUnrolled;
}

/**
 * Common function to unroll an assistant with consistent configuration
 */
async function unrollAssistantWithConfig(
  packageIdentifier: PackageIdentifier,
  accessToken: string | null,
  organizationId: string | null,
  apiClient: DefaultApiInterface,
): Promise<AssistantUnrolled> {
  const unrollResult = await unrollAssistant(
    packageIdentifier,
    new RegistryClient({
      accessToken: accessToken ?? undefined,
      apiBase: env.apiBase,
      rootPath:
        packageIdentifier.uriType === "file"
          ? dirname(packageIdentifier.fileUri)
          : undefined,
    }),
    {
      currentUserSlug: "",
      alwaysUseProxy: false,
      orgScopeId: organizationId,
      renderSecrets: true,
      platformClient: new CLIPlatformClient(organizationId, apiClient),
      onPremProxyUrl: null,
      injectBlocks: [],
    },
  );

  const errorDetails = unrollResult.errors;
  if (!unrollResult.config) {
    throw new Error(`Failed to load config:\n${errorDetails}`);
  } else if (errorDetails?.length) {
    const warnings =
      errorDetails?.length > 1
        ? errorDetails.map((d) => `\n- ${d.message}`)
        : errorDetails[0].message;
    console.warn(chalk.dim(`Warning: ${warnings}`));
  }

  return unrollResult.config;
}

/**
 * Loads a local YAML configuration file
 */
async function loadConfigYaml(
  filePath: string,
  accessToken: string | null,
  organizationId: string | null,
  apiClient: DefaultApiInterface,
): Promise<AssistantUnrolled> {
  return await unrollAssistantWithConfig(
    { fileUri: filePath, uriType: "file" },
    accessToken,
    organizationId,
    apiClient,
  );
}

/**
 * Loads an assistant by slug from the Continue platform
 */
async function loadAssistantSlug(
  slug: string,
  organizationId: string | null,
  apiClient: DefaultApiInterface,
): Promise<AssistantUnrolled> {
  const [ownerSlug, packageSlug] = slug.split("/");
  if (!ownerSlug || !packageSlug) {
    throw new Error(
      `Invalid assistant slug format. Expected "owner/package", got: ${slug}`,
    );
  }

  // Unroll locally if not logged in
  if (!(apiClient as any).configuration.accessToken) {
    return await unrollAssistantWithConfig(
      {
        uriType: "slug",
        fullSlug: { ownerSlug, packageSlug, versionSlug: "latest" },
      },
      getAccessToken(loadAuthConfig()),
      organizationId,
      apiClient,
    );
  }

  const resp = await apiClient.getAssistant({
    ownerSlug,
    packageSlug,
    alwaysUseProxy: "false",
    organizationId: organizationId ?? undefined,
  });

  const result = resp.configResult;
  const errors = result.errors;
  if (errors?.some((e: any) => e.fatal)) {
    throw new Error(
      errors.map((e: any) => e.message).join("\n") ??
        "Failed to load assistant.",
    );
  }

  return result.config as AssistantUnrolled;
}

/**
 * Determines if a config path is a file path vs assistant slug
 */
function isFilePath(configPath: string): boolean {
  return (
    configPath.startsWith(".") ||
    configPath.startsWith("/") ||
    configPath.startsWith("~") ||
    // Windows absolute paths (C:\, D:\, etc.)
    /^[A-Za-z]:[/\\]/.test(configPath) ||
    // UNC paths (\\server\share)
    configPath.startsWith("\\\\") ||
    // Contains file extension
    configPath.includes(".yaml") ||
    configPath.includes(".yml") ||
    configPath.includes(".json")
  );
}

/**
 * Converts a config source back to a URI for persistence
 */
function getUriFromSource(source: ConfigSource): string | null {
  switch (source.type) {
    case "cli-flag":
      return isFilePath(source.path)
        ? `file://${source.path}`
        : `slug://${source.path}`;
    case "saved-uri":
      return source.uri;
    case "default-config-yaml":
      return `file://${path.join(env.continueHome, "config.yaml")}`;
    default:
      return null;
  }
}
