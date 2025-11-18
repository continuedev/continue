import * as fs from "fs";
import * as path from "path";

import chalk from "chalk";

import type { AuthConfig } from "../auth/workos.js";
import { saveAuthConfig } from "../auth/workos.js";
import { getApiClient } from "../config.js";
import { env } from "../env.js";

import { AuthenticatedConfig } from "./workos-types.js";

/**
 * Creates an updated AuthenticatedConfig with a new organization ID and optional config URI
 */
export function createUpdatedAuthConfig(
  config: AuthenticatedConfig,
  organizationId: string | null | undefined,
  configUri?: string | null,
): AuthenticatedConfig {
  return {
    userId: config.userId,
    userEmail: config.userEmail,
    accessToken: config.accessToken,
    refreshToken: config.refreshToken,
    expiresAt: config.expiresAt,
    organizationId,
    configUri: configUri ?? config.configUri,
    modelName: config.modelName,
  };
}

/**
 * Check if an organization has available assistants
 */
async function hasOrgAssistants(
  apiClient: ReturnType<typeof getApiClient>,
  organizationId: string,
): Promise<boolean> {
  try {
    const assistants = await apiClient.listAssistants({ organizationId });
    return assistants.length > 0;
  } catch {
    // If we can't check, assume no assistants
    return false;
  }
}

/**
 * Get the first available assistant from an organization
 */
async function getFirstAssistant(
  apiClient: ReturnType<typeof getApiClient>,
  organizationId: string,
): Promise<string | null> {
  try {
    const assistants = await apiClient.listAssistants({ organizationId });
    if (assistants.length > 0) {
      const first = assistants[0];
      return `${first.ownerSlug}/${first.packageSlug}`;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if personal local config.yaml exists
 */
function hasPersonalLocalConfig(): boolean {
  const defaultConfigPath = path.join(env.continueHome, "config.yaml");
  return fs.existsSync(defaultConfigPath);
}

/**
 * Automatically select organization and configuration for authenticated config
 * Priority: 1) Org with assistants (+ first assistant), 2) Personal with local config.yaml, 3) Personal fallback
 */
export async function autoSelectOrganizationAndConfig(
  authenticatedConfig: AuthenticatedConfig,
): Promise<AuthConfig> {
  const apiClient = getApiClient(authenticatedConfig.accessToken);

  try {
    const resp = await apiClient.listOrganizations();
    const organizations = resp.organizations;

    // Priority 1: Find any organization that has assistants - use first assistant
    for (const org of organizations) {
      const hasAssistants = await hasOrgAssistants(apiClient, org.id);
      if (hasAssistants) {
        // Get the first assistant from this org
        const firstAssistantSlug = await getFirstAssistant(apiClient, org.id);
        const configUri = firstAssistantSlug
          ? `slug://${firstAssistantSlug}`
          : undefined;

        const updatedConfig = createUpdatedAuthConfig(
          authenticatedConfig,
          org.id,
          configUri,
        );
        saveAuthConfig(updatedConfig);
        return updatedConfig;
      }
    }

    // Priority 2: Check if personal organization has assistants
    try {
      const personalAssistants = await apiClient.listAssistants({
        organizationId: undefined,
      });
      if (personalAssistants.length > 0) {
        const firstAssistant = personalAssistants[0];
        const firstAssistantSlug = `${firstAssistant.ownerSlug}/${firstAssistant.packageSlug}`;
        const configUri = `slug://${firstAssistantSlug}`;

        const updatedConfig = createUpdatedAuthConfig(
          authenticatedConfig,
          null,
          configUri,
        );
        saveAuthConfig(updatedConfig);
        console.log(chalk.green("✓ Automatically selected personal assistant"));
        return updatedConfig;
      }
    } catch {
      // If personal assistants can't be fetched, continue to next priority
    }

    // Priority 3: If no assistants anywhere, use local config.yaml
    if (hasPersonalLocalConfig()) {
      const updatedConfig = createUpdatedAuthConfig(
        authenticatedConfig,
        null,
        `file://${path.join(env.continueHome, "config.yaml")}`,
      );
      saveAuthConfig(updatedConfig);
      console.log(chalk.green("✓ Using local config.yaml"));
      return updatedConfig;
    }

    // no org assistants or config.yaml
    const updatedConfig = createUpdatedAuthConfig(authenticatedConfig, null);
    saveAuthConfig(updatedConfig);
    return updatedConfig;
  } catch (error: any) {
    console.error(
      chalk.red("Error fetching organizations:"),
      error.response?.data?.message || error.message || error,
    );
    const updatedConfig = createUpdatedAuthConfig(authenticatedConfig, null);
    saveAuthConfig(updatedConfig);
    return updatedConfig;
  }
}
