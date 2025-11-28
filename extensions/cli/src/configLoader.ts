import * as fs from "fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as path from "path";

import {
  AssistantUnrolled,
  mergeUnrolledAssistants,
  PackageIdentifier,
  RegistryClient,
  unrollAssistant,
  unrollAssistantFromContent,
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
  updateConfigUri,
} from "./auth/workos.js";
import { CLIPlatformClient } from "./CLIPlatformClient.js";
import { env } from "./env.js";
import { logger } from "./util/logger.js";

export interface ConfigLoadResult {
  config: AssistantUnrolled;
  source: ConfigSource;
}

export type ConfigSource =
  | { type: "cli-flag"; path: string }
  | { type: "saved-uri"; uri: string }
  | { type: "user-assistant"; slug: string }
  | { type: "local-config-yaml" }
  | { type: "remote-default-config" }
  | { type: "no-config" };

/**
 * Streamlined configuration loader that implements the specification
 * with clear precedence and fallback logic in a single testable function.
 */
export async function loadConfiguration(
  authConfig: AuthConfig,
  cliConfigPath: string | undefined,
  apiClient: DefaultApiInterface,
  injectBlocks: PackageIdentifier[],
  isHeadless: boolean | undefined,
): Promise<ConfigLoadResult> {
  const organizationId = getOrganizationId(authConfig);
  const accessToken = getAccessToken(authConfig);

  // Step 1: Determine config source using precedence rules
  const configSource = determineConfigSource(
    authConfig,
    cliConfigPath,
    isHeadless,
  );

  // Step 2: Load configuration from the determined source
  const config = await loadFromSource(
    configSource,
    accessToken,
    organizationId ?? null,
    apiClient,
    injectBlocks,
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
  isHeadless: boolean | undefined,
): ConfigSource {
  // Priority 1: CLI --config flag
  if (cliConfigPath) {
    return { type: "cli-flag", path: cliConfigPath };
  }

  // Priority 2: Saved config URI (only for file-based auth)
  if (!isEnvironmentAuthConfig(authConfig) && authConfig !== null) {
    const savedUri = getConfigUri(authConfig);

    if (savedUri) {
      if (savedUri.startsWith("file:")) {
        let exists = false; // wrote like this for nested depth linting rule lol
        try {
          const filepath = fileURLToPath(savedUri);
          exists = fs.existsSync(filepath);
        } catch (e) {
          logger.warn("Invalid saved file URI " + savedUri, e);
        }
        if (exists) {
          return { type: "saved-uri", uri: savedUri };
        } else {
          logger.warn("Saved config URI does not exist: " + savedUri);
        }
      } else {
        // slug
        return { type: "saved-uri", uri: savedUri };
      }
    }
  }

  // Priority 3: Default resolution based on auth state
  if (authConfig === null) {
    // Unauthenticated: check for default config.yaml, then fallback to default config
    const defaultConfigPath = path.join(env.continueHome, "config.yaml");
    if (fs.existsSync(defaultConfigPath)) {
      return { type: "local-config-yaml" };
    }
    return { type: "remote-default-config" };
  } else {
    // In headless, user assistant fallback behavior isn't supported
    if (isHeadless) {
      return { type: "remote-default-config" };
    }
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
  injectBlocks: PackageIdentifier[],
): Promise<AssistantUnrolled> {
  try {
    switch (source.type) {
      case "cli-flag":
        return await loadFromCliFlag(
          source.path,
          accessToken,
          organizationId,
          apiClient,
          injectBlocks,
        );

      case "saved-uri":
        return await loadFromSavedUri(
          source.uri,
          accessToken,
          organizationId,
          apiClient,
          injectBlocks,
        );

      case "user-assistant":
        return await loadUserAssistantWithFallback(
          organizationId,
          apiClient,
          accessToken,
          injectBlocks,
        );

      case "local-config-yaml":
        return await loadLocalConfigYaml(
          accessToken,
          organizationId,
          apiClient,
          injectBlocks,
        );

      case "remote-default-config":
        return await loadDefaultConfig(
          organizationId,
          apiClient,
          accessToken,
          injectBlocks,
        );

      // TODO this is currently skipped because we are forcing default config
      // Because models add on won't work for injected blocks e.g. default model, (only default config)
      case "no-config":
        return await unrollPackageIdentifiersAsConfigYaml(
          injectBlocks,
          accessToken,
          organizationId,
          apiClient,
        );
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
      return await loadDefaultConfig(
        organizationId,
        apiClient,
        accessToken,
        injectBlocks,
      );
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
  injectBlocks: PackageIdentifier[],
): Promise<AssistantUnrolled> {
  if (isFilePath(configPath)) {
    // Load local YAML file
    return await loadConfigYaml(
      configPath,
      accessToken,
      organizationId,
      apiClient,
      injectBlocks,
    );
  } else {
    // Load assistant slug
    return await loadAssistantSlug(
      configPath,
      accessToken,
      organizationId,
      apiClient,
      injectBlocks,
    );
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
  injectBlocks: PackageIdentifier[],
): Promise<AssistantUnrolled> {
  const filePath = uriToPath(uri);
  if (filePath) {
    return await loadConfigYaml(
      filePath,
      accessToken,
      organizationId,
      apiClient,
      injectBlocks,
    );
  }

  const slug = uriToSlug(uri);
  if (slug) {
    return await loadAssistantSlug(
      slug,
      accessToken,
      organizationId,
      apiClient,
      injectBlocks,
    );
  }

  throw new Error(`Invalid saved config URI: ${uri}`);
}

/**
 * Loads first available user assistant with fallback to default agent
 */
async function loadUserAssistantWithFallback(
  organizationId: string | null,
  apiClient: DefaultApiInterface,
  accessToken: string | null,
  injectBlocks: PackageIdentifier[],
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
    let apiConfig = result.config as AssistantUnrolled;
    if (injectBlocks.length > 0) {
      const injectedConfig = await unrollPackageIdentifiersAsConfigYaml(
        injectBlocks,
        accessToken,
        organizationId,
        apiClient,
      );
      apiConfig = mergeUnrolledAssistants(apiConfig, injectedConfig);
    }

    return apiConfig;
  }

  // No user assistants, fall back to default agent
  return await loadDefaultConfig(
    organizationId,
    apiClient,
    accessToken,
    injectBlocks,
  );
}

/**
 * Loads default config.yaml from ~/.continue/config.yaml
 */
async function loadLocalConfigYaml(
  accessToken: string | null,
  organizationId: string | null,
  apiClient: DefaultApiInterface,
  injectBlocks: PackageIdentifier[],
): Promise<AssistantUnrolled> {
  const defaultConfigPath = path.join(env.continueHome, "config.yaml");
  return await loadConfigYaml(
    defaultConfigPath,
    accessToken,
    organizationId,
    apiClient,
    injectBlocks,
  );
}

/**
 * Loads the default continuedev/default-config
 */
async function loadDefaultConfig(
  organizationId: string | null,
  apiClient: DefaultApiInterface,
  accessToken: string | null,
  injectBlocks: PackageIdentifier[],
): Promise<AssistantUnrolled> {
  const resp = await apiClient.getAssistant({
    ownerSlug: "continuedev",
    packageSlug: "default-cli-config",
    organizationId: organizationId ?? undefined,
  });

  if (!resp.configResult.config) {
    throw new Error("Failed to load default agent.");
  }
  let apiConfig = resp.configResult.config as AssistantUnrolled;
  if (injectBlocks.length > 0) {
    const injectedConfig = await unrollPackageIdentifiersAsConfigYaml(
      injectBlocks,
      accessToken,
      organizationId,
      apiClient,
    );
    apiConfig = mergeUnrolledAssistants(apiConfig, injectedConfig);
  }

  return apiConfig;
}

export async function unrollPackageIdentifiersAsConfigYaml(
  packageIdentifiers: PackageIdentifier[],
  accessToken: string | null,
  organizationId: string | null,
  apiClient: DefaultApiInterface,
): Promise<AssistantUnrolled> {
  const unrollResult = await unrollAssistantFromContent(
    {
      uriType: "file",
      fileUri: "",
    },
    "name: Agent\nschema: v1\nversion: 0.0.1",
    new RegistryClient({
      accessToken: accessToken ?? undefined,
      apiBase: env.apiBase,
      rootPath: undefined, // TODO verify this doesn't cause issues with file blocks
    }),
    {
      currentUserSlug: "",
      onPremProxyUrl: null,
      orgScopeId: organizationId,
      platformClient: new CLIPlatformClient(organizationId, apiClient),
      renderSecrets: true,
      injectBlocks: packageIdentifiers,
    },
  );
  if (unrollResult.errors) {
    const fatalError = unrollResult.errors?.find((e) => e.fatal);
    if (fatalError) {
      throw new Error(`Failed to load config: ${fatalError.message}`);
    }
  }
  if (!unrollResult?.config) {
    throw new Error(`Failed to load config`);
  }

  return unrollResult.config;
}

async function unrollAssistantWithConfig(
  packageIdentifier: PackageIdentifier,
  accessToken: string | null,
  organizationId: string | null,
  apiClient: DefaultApiInterface,
  injectBlocks: PackageIdentifier[],
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
      injectBlocks,
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
  injectBlocks: PackageIdentifier[],
): Promise<AssistantUnrolled> {
  return await unrollAssistantWithConfig(
    { fileUri: filePath, uriType: "file" },
    accessToken,
    organizationId,
    apiClient,
    injectBlocks,
  );
}

/**
 * Loads an assistant by slug from the Continue platform
 */
async function loadAssistantSlug(
  slug: string,
  accessToken: string | null,
  organizationId: string | null,
  apiClient: DefaultApiInterface,
  injectBlocks: PackageIdentifier[],
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
      accessToken ?? null,
      organizationId,
      apiClient,
      injectBlocks,
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
  let apiConfig = result.config as AssistantUnrolled;
  if (injectBlocks.length > 0) {
    const injectedConfig = await unrollPackageIdentifiersAsConfigYaml(
      injectBlocks,
      accessToken,
      organizationId,
      apiClient,
    );
    apiConfig = mergeUnrolledAssistants(apiConfig, injectedConfig);
  }

  return apiConfig;
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
    case "local-config-yaml":
      return `file://${path.join(env.continueHome, "config.yaml")}`;
    default:
      return null;
  }
}
