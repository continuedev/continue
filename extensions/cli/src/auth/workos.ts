import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import chalk from "chalk";
import nodeFetch from "node-fetch";
import open from "open";

import { logger } from "src/util/logger.js";

import { getApiClient } from "../config.js";
// eslint-disable-next-line import/order
import { env } from "../env.js";

if (!globalThis.fetch) {
  globalThis.fetch = nodeFetch as unknown as typeof globalThis.fetch;
}

// Config file path - define as a function to avoid initialization order issues
function getAuthConfigPath() {
  const continueHome =
    process.env.CONTINUE_GLOBAL_DIR || path.join(os.homedir(), ".continue");
  return path.join(continueHome, "auth.json");
}

// Union type representing the possible authentication states
export type AuthConfig = AuthenticatedConfig | EnvironmentAuthConfig | null;

/**
 * Type guard to check if config is authenticated via file-based auth
 */
export function isAuthenticatedConfig(
  config: AuthConfig,
): config is AuthenticatedConfig {
  return config !== null && "userId" in config;
}

/**
 * Type guard to check if config is authenticated via environment variable
 */
export function isEnvironmentAuthConfig(
  config: AuthConfig,
): config is EnvironmentAuthConfig {
  return config !== null && !("userId" in config);
}

/**
 * Gets the access token from any auth config type
 */
export function getAccessToken(config: AuthConfig): string | null {
  if (config === null) return null;
  return config.accessToken;
}

/**
 * Gets the organization ID from any auth config type
 */
export function getOrganizationId(
  config: AuthConfig,
): string | null | undefined {
  if (config === null) return null;
  return config.organizationId;
}

/**
 * Gets the config URI from any auth config type
 */
export function getConfigUri(config: AuthConfig): string | null {
  if (config === null) return null;
  return config.configUri || null;
}

/**
 * Gets the model name from any auth config type
 * For unauthenticated users or when auth config has no modelName, checks GlobalContext
 */
export function getModelName(config: AuthConfig): string | null {
  // Priority 1: Logged-in users with modelName in auth config
  if (config !== null && config.modelName) {
    return config.modelName;
  }

  // Priority 2: Fall back to GlobalContext (for logged-out users or logged-in without modelName)
  return getPersistedModelName();
}

// URI utility functions have been moved to ./uriUtils.ts
import {
  getPersistedModelName,
  persistModelName,
} from "../util/modelPersistence.js";

import { autoSelectOrganizationAndConfig } from "./orgSelection.js";
import { pathToUri, slugToUri, uriToPath, uriToSlug } from "./uriUtils.js";
import {
  AuthenticatedConfig,
  DeviceAuthorizationResponse,
  EnvironmentAuthConfig,
} from "./workos-types.js";
import {
  handleCliOrgForAuthenticatedConfig,
  handleCliOrgForEnvironmentAuth,
} from "./workos.helpers.js";

/**
 * Legacy functions for backward compatibility
 */
export function getAssistantSlug(config: AuthConfig): string | null {
  const uri = getConfigUri(config);
  return uri ? uriToSlug(uri) : null;
}

export function getLocalConfigPath(config: AuthConfig): string | null {
  const uri = getConfigUri(config);
  return uri ? uriToPath(uri) : null;
}

/**
 * Loads the authentication configuration from disk
 */
export function loadAuthConfig(): AuthConfig {
  // If CONTINUE_API_KEY environment variable exists, use that instead
  if (process.env.CONTINUE_API_KEY) {
    return {
      accessToken: process.env.CONTINUE_API_KEY,
      organizationId: null,
    };
  }

  try {
    const authConfigPath = getAuthConfigPath();
    if (fs.existsSync(authConfigPath)) {
      const data = JSON.parse(fs.readFileSync(authConfigPath, "utf8"));

      // Validate that we have all required fields for authenticated config
      if (
        data.userId &&
        data.userEmail &&
        data.accessToken &&
        data.refreshToken &&
        data.expiresAt
      ) {
        return {
          userId: data.userId,
          userEmail: data.userEmail,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresAt: data.expiresAt,
          organizationId: data.organizationId || null,
          configUri: data.configUri,
          modelName: data.modelName,
        };
      } else {
        console.warn("Invalid auth config found, ignoring.");
        return null;
      }
    }
  } catch (error) {
    console.error(`Error loading auth config: ${error}`);
  }

  return null;
}

/**
 * Saves the authentication configuration to disk
 */
export function saveAuthConfig(config: AuthenticatedConfig): void {
  // If using CONTINUE_API_KEY environment variable, don't save anything
  if (process.env.CONTINUE_API_KEY) {
    return;
  }

  try {
    const authConfigPath = getAuthConfigPath();
    // Make sure the directory exists
    const dir = path.dirname(authConfigPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(authConfigPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error(`Error saving auth config: ${error}`);
  }
}

/**
 * Updates the config URI in the authentication configuration
 */
export function updateConfigUri(configUri: string | null): void {
  // If using CONTINUE_API_KEY environment variable, don't save anything
  if (process.env.CONTINUE_API_KEY) {
    return;
  }

  const config = loadAuthConfig();
  if (config && isAuthenticatedConfig(config)) {
    const updatedConfig: AuthenticatedConfig = {
      ...config,
      configUri: configUri || undefined,
    };
    saveAuthConfig(updatedConfig);
  }
}

/**
 * Updates the model name in the authentication configuration
 * Returns the updated config so the caller can update in-memory state
 * For unauthenticated users, saves to GlobalContext
 */
export function updateModelName(modelName: string | null): AuthConfig {
  // If using CONTINUE_API_KEY environment variable, don't save anything
  if (process.env.CONTINUE_API_KEY) {
    return loadAuthConfig();
  }

  const config = loadAuthConfig();

  // If logged in, save to auth.json
  if (config && isAuthenticatedConfig(config)) {
    const updatedConfig: AuthenticatedConfig = {
      ...config,
      modelName: modelName || undefined,
    };
    saveAuthConfig(updatedConfig);
    return updatedConfig;
  }

  // If logged out, save to GlobalContext
  persistModelName(modelName);
  return config;
}

/**
 * Legacy functions for backward compatibility
 */
export function updateAssistantSlug(assistantSlug: string | null): void {
  updateConfigUri(assistantSlug ? slugToUri(assistantSlug) : null);
}

export function updateLocalConfigPath(localConfigPath: string | null): void {
  updateConfigUri(localConfigPath ? pathToUri(localConfigPath) : null);
}

/**
 * Checks if the user is authenticated and the token is valid
 */
export async function isAuthenticated(): Promise<boolean> {
  const config = loadAuthConfig();

  if (config === null) {
    return false;
  }

  if (isEnvironmentAuthConfig(config)) {
    return true;
  }

  if (Date.now() > config.expiresAt) {
    try {
      const refreshed = await refreshToken(config.refreshToken);
      return isAuthenticatedConfig(refreshed);
    } catch (e) {
      logger.error("Failed to refresh auto token", e);
      return false;
    }
  }

  return true;
}

/**
 * Request device authorization from WorkOS
 */
async function requestDeviceAuthorization(): Promise<DeviceAuthorizationResponse> {
  try {
    const params = new URLSearchParams({
      client_id: env.workOsClientId,
      screen_hint: "sign-up",
    });

    // Use WorkOS User Management device authorization endpoint
    const response = await fetch(
      "https://api.workos.com/user_management/authorize/device",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error(
      chalk.red("Device authorization error:"),
      error.message || error,
    );
    throw error;
  }
}

/**
 * Poll for device authorization completion
 */
async function pollForDeviceToken(
  deviceCode: string,
  interval: number,
  expiresIn: number,
): Promise<AuthenticatedConfig> {
  const startTime = Date.now();
  const expirationTime = startTime + expiresIn * 1000;
  let currentInterval = interval;

  while (Date.now() < expirationTime) {
    try {
      const params = new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: deviceCode,
        client_id: env.workOsClientId,
      });

      const headers: Record<string, string> = {
        "Content-Type": "application/x-www-form-urlencoded",
      };

      // Poll WorkOS User Management token endpoint
      const response = await fetch(
        "https://api.workos.com/user_management/authenticate",
        {
          method: "POST",
          headers,
          body: params,
        },
      );

      if (response.ok) {
        const data = await response.json();
        const { access_token, refresh_token, user } = data;

        // Calculate token expiration (assuming 1 hour validity)
        const tokenExpiresAt = Date.now() + 60 * 60 * 1000;

        const authConfig: AuthenticatedConfig = {
          userId: user.id,
          userEmail: user.email,
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresAt: tokenExpiresAt,
          organizationId: undefined, // undefined triggers auto-selection, null means personal org selected
        };

        // Save the config
        saveAuthConfig(authConfig);

        return authConfig;
      } else {
        // Handle HTTP error responses
        const errorData = await response.json().catch(() => ({}));
        const errorCode = errorData.error;

        // Log response details for debugging
        if (response.status === 401) {
          throw new Error(
            "Oops! We had trouble authenticating. Please try again and reach out if the error persists.",
          );
        }

        if (errorCode === "authorization_pending") {
          // Continue polling
          await new Promise((resolve) =>
            setTimeout(resolve, currentInterval * 1000),
          );
          continue;
        } else if (errorCode === "slow_down") {
          // Increase polling interval
          currentInterval += 5;
          await new Promise((resolve) =>
            setTimeout(resolve, currentInterval * 1000),
          );
          continue;
        } else if (errorCode === "access_denied") {
          throw new Error("User denied access");
        } else if (errorCode === "expired_token") {
          throw new Error("Device code has expired");
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }
    } catch (error: any) {
      console.error(chalk.red("Token polling error:"), error.message || error);
      throw error;
    }
  }

  throw new Error("Device authorization timeout");
}

/**
 * Refreshes the access token using a refresh token
 */
async function refreshToken(
  refreshToken: string,
): Promise<AuthenticatedConfig> {
  try {
    // Load existing config to preserve organizationId and other fields
    const existingConfig = loadAuthConfig();

    const response = await fetch(new URL("auth/refresh", env.apiBase), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const { accessToken, refreshToken: newRefreshToken, user } = data;

    // Calculate token expiration (assuming 1 hour validity)
    const tokenExpiresAt = Date.now() + 60 * 60 * 1000;

    const authConfig: AuthenticatedConfig = {
      userId: user.id,
      userEmail: user.email,
      accessToken,
      refreshToken: newRefreshToken,
      expiresAt: tokenExpiresAt,
      // Preserve existing organizationId if it exists, otherwise set to null
      organizationId: isAuthenticatedConfig(existingConfig)
        ? existingConfig.organizationId
        : null,
      // Preserve existing configUri if it exists
      configUri: isAuthenticatedConfig(existingConfig)
        ? existingConfig.configUri
        : undefined,
      // Preserve existing modelName if it exists
      modelName: isAuthenticatedConfig(existingConfig)
        ? existingConfig.modelName
        : undefined,
    };

    // Save the config
    saveAuthConfig(authConfig);

    return authConfig;
  } catch (error: any) {
    console.error(chalk.red("Token refresh error:"), error.message || error);
    throw error;
  }
}

/**
 * Authenticates using the WorkOS device flow
 */
export async function login(): Promise<AuthConfig> {
  // If CONTINUE_API_KEY environment variable exists, use that instead
  if (process.env.CONTINUE_API_KEY) {
    console.info(
      chalk.green("Using CONTINUE_API_KEY from environment variables"),
    );
    return {
      accessToken: process.env.CONTINUE_API_KEY,
      organizationId: null,
    };
  }

  console.info(chalk.white("\nSigning in with Continue..."));

  // Request device authorization
  const deviceAuth = await requestDeviceAuthorization();

  console.info(
    chalk.white(
      `Your authentication code: ${chalk.bold(deviceAuth.user_code)}`,
    ),
  );
  console.info(
    chalk.dim(
      `If the browser doesn't automatically open, use this link: ${deviceAuth.verification_uri_complete}`,
    ),
  );

  // Try to open the complete verification URL in browser
  try {
    await open(deviceAuth.verification_uri_complete);
  } catch {
    console.info(chalk.yellow("Unable to open browser automatically"));
  }

  console.info(chalk.dim("\nWaiting for confirmation..."));

  // Poll for token
  const authConfig = await pollForDeviceToken(
    deviceAuth.device_code,
    deviceAuth.interval,
    deviceAuth.expires_in,
  );

  console.info(chalk.white("✅ Success!"));

  return authConfig;
}

/**
 * Ensures the user has selected an organization, automatically selecting the first one if available
 */
export async function ensureOrganization(
  authConfig: AuthConfig,
  isHeadless: boolean = false,
  cliOrganizationSlug?: string,
): Promise<AuthConfig> {
  // Handle CLI organization slug if provided (undefined means no --org flag or --org personal)
  if (cliOrganizationSlug) {
    // For environment auth configs
    if (isEnvironmentAuthConfig(authConfig)) {
      return handleCliOrgForEnvironmentAuth(
        authConfig,
        cliOrganizationSlug,
        isHeadless,
      );
    }
  } else if (isEnvironmentAuthConfig(authConfig)) {
    // No CLI organization slug (or "personal" was specified)
    // If using API key auth, attempt to resolve its organization scope once
    const resolved = await resolveOrgScopeForApiKey(authConfig);
    return resolved;
  }

  // If not authenticated, return as-is
  if (!isAuthenticatedConfig(authConfig)) {
    return authConfig;
  }

  // TypeScript now knows authConfig is AuthenticatedConfig
  const authenticatedConfig: AuthenticatedConfig = authConfig;

  // If a CLI organization slug is provided, try to use it (for authenticated configs)
  if (cliOrganizationSlug) {
    return handleCliOrgForAuthenticatedConfig(
      authenticatedConfig,
      cliOrganizationSlug,
      isHeadless,
    );
  }

  // Only auto-select if user hasn't made any previous selections
  // - organizationId === undefined means first-time setup
  // - configUri being set means they've chosen a specific assistant/config
  if (
    authenticatedConfig.organizationId === undefined &&
    !authenticatedConfig.configUri
  ) {
    return autoSelectOrganizationAndConfig(authenticatedConfig);
  }

  // User already has made a selection (org or config) - respect their choice
  return authenticatedConfig;
}

/**
 * Attempts to resolve the organization scope for API key auth (environment-based auth).
 * Calls a lightweight backend endpoint to determine if the API key is an org-scoped key.
 * If successful, returns a new EnvironmentAuthConfig with organizationId set; otherwise returns the original config.
 */
async function resolveOrgScopeForApiKey(
  envConfig: EnvironmentAuthConfig,
): Promise<EnvironmentAuthConfig> {
  // If already set (including explicit null), return as-is
  if (envConfig.organizationId !== null) {
    return envConfig;
  }

  const accessToken = envConfig.accessToken;
  if (!accessToken) return envConfig;

  try {
    // Prefer a dedicated endpoint for scope discovery. This should return JSON like:
    // { organizationId: string | null } (aka orgScopeId)
    const url = new URL("auth/scope", env.apiBase);
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!resp.ok) {
      // Gracefully ignore if the endpoint isn't available yet (e.g., 404) or other non-2xx errors
      return envConfig;
    }

    const data: any = await resp.json().catch(() => ({}));
    const orgId =
      data?.organizationId ??
      data?.orgScopeId ??
      data?.organization?.id ??
      null;

    if (orgId && typeof orgId === "string") {
      return {
        ...envConfig,
        organizationId: orgId,
      };
    }
  } catch {
    // Network or parsing issues: leave config unchanged
  }

  return envConfig;
}

/**
 * Gets the list of available organizations for the user
 */
export async function listUserOrganizations(): Promise<
  { id: string; name: string; slug: string }[] | null
> {
  const authConfig = loadAuthConfig();

  // If using CONTINUE_API_KEY environment variable, organization switching is not supported
  if (isEnvironmentAuthConfig(authConfig)) {
    return null;
  }

  if (!isAuthenticatedConfig(authConfig)) {
    return null;
  }

  const apiClient = getApiClient(authConfig.accessToken);

  try {
    const resp = await apiClient.listOrganizations();
    // Map the organizations to include slug field
    return (
      resp.organizations?.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
      })) || []
    );
  } catch {
    return null;
  }
}

/**
 * Checks if the user has multiple organizations available
 */
export async function hasMultipleOrganizations(): Promise<boolean> {
  const organizations = await listUserOrganizations();
  // Has multiple organizations if there's at least one organization (plus personal)
  return organizations !== null && organizations.length > 0;
}

/**
 * Logs the user out by clearing saved credentials
 */
export function logout(): void {
  const continueHome =
    process.env.CONTINUE_GLOBAL_DIR || path.join(os.homedir(), ".continue");
  const onboardingFlagPath = path.join(continueHome, ".onboarding_complete");

  // Remove onboarding completion flag so user will go through onboarding again
  if (fs.existsSync(onboardingFlagPath)) {
    fs.unlinkSync(onboardingFlagPath);
  }

  if (process.env.CONTINUE_API_KEY) {
    console.info(
      chalk.yellow(
        "Using CONTINUE_API_KEY from environment variables, nothing to log out",
      ),
    );
    return;
  }

  const authConfigPath = getAuthConfigPath();
  if (fs.existsSync(authConfigPath)) {
    fs.unlinkSync(authConfigPath);
    console.info(chalk.green("Successfully logged out"));
  } else {
    console.info(chalk.yellow("No active session found"));
  }
}
