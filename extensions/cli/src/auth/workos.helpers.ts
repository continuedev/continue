import chalk from "chalk";

import { getApiClient } from "../config.js";
import { safeStderr } from "../init.js";
import { gracefulExit } from "../util/exit.js";

import { AuthenticatedConfig, EnvironmentAuthConfig } from "./workos-types.js";
import type { AuthConfig } from "./workos.js";
import { saveAuthConfig } from "./workos.js";

/**
 * Creates an updated AuthenticatedConfig with a new organization ID
 */
export function createUpdatedAuthConfig(
  config: AuthenticatedConfig,
  organizationId: string | null | undefined,
): AuthenticatedConfig {
  return {
    userId: config.userId,
    userEmail: config.userEmail,
    accessToken: config.accessToken,
    refreshToken: config.refreshToken,
    expiresAt: config.expiresAt,
    organizationId,
    configUri: config.configUri,
    modelName: config.modelName,
  };
}

/**
 * Helper function to resolve organization by slug
 */
export async function resolveOrganizationBySlug(
  apiClient: ReturnType<typeof getApiClient>,
  organizationSlug: string,
): Promise<{ id: string; slug: string }> {
  const resp = await apiClient.listOrganizations();
  const organizations = resp.organizations;

  // Find organization by slug (case-insensitive)
  const matchedOrg = organizations.find(
    (org) => org?.slug?.toLowerCase() === organizationSlug.toLowerCase(),
  );

  if (matchedOrg) {
    return { id: matchedOrg.id, slug: matchedOrg.slug };
  } else {
    // Organization not found - show available options
    const availableSlugs = organizations
      .map((org) => org?.slug)
      .filter(Boolean);
    const availableOptions = ["personal", ...availableSlugs];
    console.info(
      chalk.yellow("Available organizations:"),
      availableOptions.join(", "),
    );

    throw new Error(`Organization "${organizationSlug}" not found`);
  }
}

/**
 * Handle CLI organization flag for environment auth configs
 */
export async function handleCliOrgForEnvironmentAuth(
  authConfig: EnvironmentAuthConfig,
  cliOrganizationSlug: string,
  isHeadless: boolean,
): Promise<AuthConfig> {
  // Only allow --org flag in headless mode
  if (!isHeadless) {
    safeStderr(
      chalk.red(
        "The --org flag is only supported in headless mode (with -p/--print flag)\n",
      ),
    );
    await gracefulExit(1);
  }

  const apiClient = getApiClient(authConfig.accessToken);
  const resolvedOrg = await resolveOrganizationBySlug(
    apiClient,
    cliOrganizationSlug,
  );

  // Return modified environment auth config with organization ID
  return {
    ...authConfig,
    organizationId: resolvedOrg.id,
  };
}

/**
 * Handle CLI organization flag for authenticated configs
 */
export async function handleCliOrgForAuthenticatedConfig(
  authenticatedConfig: AuthenticatedConfig,
  cliOrganizationSlug: string,
  isHeadless: boolean,
): Promise<AuthConfig> {
  // Only allow --org flag in headless mode
  if (!isHeadless) {
    safeStderr(
      chalk.red(
        "The --org flag is only supported in headless mode (with -p/--print flag)\n",
      ),
    );
    await gracefulExit(1);
  }

  const apiClient = getApiClient(authenticatedConfig.accessToken);
  const resolvedOrg = await resolveOrganizationBySlug(
    apiClient,
    cliOrganizationSlug,
  );

  const updatedConfig = createUpdatedAuthConfig(
    authenticatedConfig,
    resolvedOrg.id,
  );
  saveAuthConfig(updatedConfig);
  return updatedConfig;
}
