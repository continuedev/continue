import * as fs from "fs";
import * as path from "path";

import chalk from "chalk";
// Polyfill fetch for Node < 18
import nodeFetch from "node-fetch";
import open from "open";

import { getApiClient } from "../config.js";
import { env } from "../env.js";
if (!globalThis.fetch) {
  globalThis.fetch = nodeFetch as unknown as typeof globalThis.fetch;
}

// Config file path
const AUTH_CONFIG_PATH = path.join(env.continueHome, "auth.json");

// Represents an authenticated user's configuration
export interface AuthenticatedConfig {
  userId: string;
  userEmail: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  organizationId: string | null; // null means personal organization
  configUri?: string; // Optional config URI (file:// or slug://owner/slug)
  modelName?: string; // Name of the selected model
}

// Represents configuration when using environment variable auth
export interface EnvironmentAuthConfig {
  /**
   * This userId?: undefined; field a trick to help TypeScript differentiate between
   * AuthenticatedConfig and EnvironmentAuthConfig. Otherwise AuthenticatedConfig is
   * a possible subtype of EnvironmentAuthConfig and TypeScript gets confused where
   * type guards are involved.
   */
  userId?: undefined;
  accessToken: string;
  organizationId: string | null; // Can be set via --org flag in headless mode
  configUri?: string; // Optional config URI (file:// or slug://owner/slug)
  modelName?: string; // Name of the selected model
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
export function getOrganizationId(config: AuthConfig): string | null {
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
 */
export function getModelName(config: AuthConfig): string | null {
  if (config === null) return null;
  return config.modelName || null;
}

// URI utility functions have been moved to ./uriUtils.ts
import { pathToUri, slugToUri, uriToPath, uriToSlug } from "./uriUtils.js";
import {
  autoSelectOrganization,
  createUpdatedAuthConfig,
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
    if (fs.existsSync(AUTH_CONFIG_PATH)) {
      const data = JSON.parse(fs.readFileSync(AUTH_CONFIG_PATH, "utf8"));

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
    // Make sure the directory exists
    const dir = path.dirname(AUTH_CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(AUTH_CONFIG_PATH, JSON.stringify(config, null, 2));
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
 */
export function updateModelName(modelName: string | null): void {
  // If using CONTINUE_API_KEY environment variable, don't save anything
  if (process.env.CONTINUE_API_KEY) {
    return;
  }

  const config = loadAuthConfig();
  if (config && isAuthenticatedConfig(config)) {
    const updatedConfig: AuthenticatedConfig = {
      ...config,
      modelName: modelName || undefined,
    };
    saveAuthConfig(updatedConfig);
  }
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
export function isAuthenticated(): boolean {
  const config = loadAuthConfig();

  if (config === null) {
    return false;
  }

  // Environment auth is always valid
  if (isEnvironmentAuthConfig(config)) {
    return true;
  }

  /**
   * THIS CODE DOESN'T WORK.
   * .catch() will never return in a non-async function.
   * It's a hallucination.
   **/
  if (Date.now() > config.expiresAt) {
    // Try refreshing the token
    refreshToken(config.refreshToken).catch(() => {
      // If refresh fails, we're not authenticated
      return false;
    });
  }

  return true;
}

/**
 * Device authorization response from WorkOS
 */
interface DeviceAuthorizationResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
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
          organizationId: null,
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
    // No CLI organization slug (or "personal" was specified) - return as-is
    return authConfig;
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

  // If already have organization ID (including null for personal), return as-is
  if (authenticatedConfig.organizationId !== undefined) {
    return authenticatedConfig;
  }

  // In headless mode, default to personal organization if none saved
  if (isHeadless) {
    const updatedConfig = createUpdatedAuthConfig(authenticatedConfig, null);
    saveAuthConfig(updatedConfig);
    return updatedConfig;
  }

  // Need to select organization
  return autoSelectOrganization(authenticatedConfig);
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
  const onboardingFlagPath = path.join(
    env.continueHome,
    ".onboarding_complete",
  );

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

  if (fs.existsSync(AUTH_CONFIG_PATH)) {
    fs.unlinkSync(AUTH_CONFIG_PATH);
    console.info(chalk.green("Successfully logged out"));
  } else {
    console.info(chalk.yellow("No active session found"));
  }
}
