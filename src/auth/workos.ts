import {
  Configuration,
  DefaultApi,
} from "@continuedev/sdk/dist/api/dist/index.js";
import chalk from "chalk";
import * as fs from "fs";
import open from "open";
import * as os from "os";
import * as path from "path";
import { createInterface } from "readline";
import { env } from "../env.js";

// Polyfill fetch for Node < 18
import nodeFetch from "node-fetch";
if (!globalThis.fetch) {
  globalThis.fetch = nodeFetch as unknown as typeof globalThis.fetch;
}

// Config file path
const AUTH_CONFIG_PATH = path.join(os.homedir(), ".continue", "auth.json");

// Represents an authenticated user's configuration
export interface AuthenticatedConfig {
  userId: string;
  userEmail: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  organizationId: string | null; // null means personal organization
  assistantSlug?: string; // Optional assistant slug
}

// Represents configuration when using environment variable auth
export interface EnvironmentAuthConfig {
  accessToken: string;
  organizationId: null; // Environment auth always uses personal organization
  assistantSlug?: string; // Optional assistant slug
}

// Union type representing the possible authentication states
export type AuthConfig = AuthenticatedConfig | EnvironmentAuthConfig | null;

/**
 * Type guard to check if config is authenticated via file-based auth
 */
export function isAuthenticatedConfig(
  config: AuthConfig
): config is AuthenticatedConfig {
  return config !== null && "userId" in config;
}

/**
 * Type guard to check if config is authenticated via environment variable
 */
export function isEnvironmentAuthConfig(
  config: AuthConfig
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
 * Gets the assistant slug from any auth config type
 */
export function getAssistantSlug(config: AuthConfig): string | null {
  if (config === null) return null;
  return config.assistantSlug || null;
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
          assistantSlug: data.assistantSlug || undefined,
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
 * Updates the assistant slug in the authentication configuration
 */
export function updateAssistantSlug(assistantSlug: string | null): void {
  // If using CONTINUE_API_KEY environment variable, don't save anything
  if (process.env.CONTINUE_API_KEY) {
    return;
  }

  const config = loadAuthConfig();
  if (config && isAuthenticatedConfig(config)) {
    const updatedConfig: AuthenticatedConfig = {
      ...config,
      assistantSlug: assistantSlug || undefined,
    };
    saveAuthConfig(updatedConfig);
  }
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

  // Check if token is expired
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
 * Prompt the user for input
 */
function prompt(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
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
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error(
      chalk.red("Device authorization error:"),
      error.message || error
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
  expiresIn: number
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
        }
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
            "Oops! We had trouble authenticating. Please try again and reach out if the error persists."
          );
        }

        if (errorCode === "authorization_pending") {
          // Continue polling
          await new Promise((resolve) =>
            setTimeout(resolve, currentInterval * 1000)
          );
          continue;
        } else if (errorCode === "slow_down") {
          // Increase polling interval
          currentInterval += 5;
          await new Promise((resolve) =>
            setTimeout(resolve, currentInterval * 1000)
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
  refreshToken: string
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
      // Preserve existing assistantSlug if it exists
      assistantSlug: isAuthenticatedConfig(existingConfig)
        ? existingConfig.assistantSlug
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
      chalk.green("Using CONTINUE_API_KEY from environment variables")
    );
    return {
      accessToken: process.env.CONTINUE_API_KEY,
      organizationId: null,
    };
  }

  try {
    console.info(chalk.cyan("\nStarting authentication with Continue..."));

    // Request device authorization
    const deviceAuth = await requestDeviceAuthorization();

    console.info(
      chalk.yellow(
        `Your authentication code: ${chalk.bold(deviceAuth.user_code)}`
      )
    );
    console.info(
      chalk.dim(
        `If the browser doesn't automatically open, use this link: ${deviceAuth.verification_uri_complete}`
      )
    );

    // Try to open the complete verification URL in browser
    try {
      await open(deviceAuth.verification_uri_complete);
    } catch (error) {
      console.info(chalk.yellow("Unable to open browser automatically"));
    }

    console.info(chalk.cyan("\nWaiting for confirmation..."));

    // Poll for token
    const authConfig = await pollForDeviceToken(
      deviceAuth.device_code,
      deviceAuth.interval,
      deviceAuth.expires_in
    );

    console.info(chalk.green("\nAuthentication successful!"));

    return authConfig;
  } catch (error: any) {
    console.error(chalk.red("Authentication error:"), error.message || error);
    throw error;
  }
}

/**
 * Ensures the user has selected an organization, automatically selecting the first one if available
 */
export async function ensureOrganization(
  authConfig: AuthConfig,
  isHeadless: boolean = false
): Promise<AuthConfig> {
  // If using CONTINUE_API_KEY environment variable, don't require organization selection
  if (isEnvironmentAuthConfig(authConfig)) {
    return authConfig;
  }

  // If not authenticated, return as-is
  if (!isAuthenticatedConfig(authConfig)) {
    return authConfig;
  }

  // TypeScript now knows authConfig is AuthenticatedConfig
  const authenticatedConfig = authConfig;

  // If already have organization ID (including null for personal), return as-is
  if (authenticatedConfig.organizationId !== undefined) {
    return authenticatedConfig;
  }

  // In headless mode, default to personal organization if none saved
  if (isHeadless) {
    const updatedConfig: AuthenticatedConfig = {
      userId: authenticatedConfig.userId,
      userEmail: authenticatedConfig.userEmail,
      accessToken: authenticatedConfig.accessToken,
      refreshToken: authenticatedConfig.refreshToken,
      expiresAt: authenticatedConfig.expiresAt,
      organizationId: null, // Default to personal organization
      assistantSlug: authenticatedConfig.assistantSlug,
    };
    saveAuthConfig(updatedConfig);
    return updatedConfig;
  }

  // Need to select organization
  const apiClient = new DefaultApi(
    new Configuration({
      accessToken: authenticatedConfig.accessToken,
    })
  );

  try {
    const resp = await apiClient.listOrganizations();
    const organizations = resp.organizations;

    if (organizations.length === 0) {
      const updatedConfig: AuthenticatedConfig = {
        userId: authenticatedConfig.userId,
        userEmail: authenticatedConfig.userEmail,
        accessToken: authenticatedConfig.accessToken,
        refreshToken: authenticatedConfig.refreshToken,
        expiresAt: authenticatedConfig.expiresAt,
        organizationId: null,
        assistantSlug: authenticatedConfig.assistantSlug,
      };
      saveAuthConfig(updatedConfig);
      return updatedConfig;
    }

    // Automatically select the first organization if available, otherwise use personal
    const selectedOrg = organizations[0];
    const selectedOrgId = selectedOrg.id;

    const updatedConfig: AuthenticatedConfig = {
      userId: authenticatedConfig.userId,
      userEmail: authenticatedConfig.userEmail,
      accessToken: authenticatedConfig.accessToken,
      refreshToken: authenticatedConfig.refreshToken,
      expiresAt: authenticatedConfig.expiresAt,
      organizationId: selectedOrgId,
      assistantSlug: authenticatedConfig.assistantSlug,
    };

    saveAuthConfig(updatedConfig);
    return updatedConfig;
  } catch (error: any) {
    console.error(
      chalk.red("Error fetching organizations:"),
      error.response?.data?.message || error.message || error
    );
    console.info(chalk.yellow("Continuing without organization selection."));
    const updatedConfig: AuthenticatedConfig = {
      userId: authenticatedConfig.userId,
      userEmail: authenticatedConfig.userEmail,
      accessToken: authenticatedConfig.accessToken,
      refreshToken: authenticatedConfig.refreshToken,
      expiresAt: authenticatedConfig.expiresAt,
      organizationId: null,
      assistantSlug: authenticatedConfig.assistantSlug,
    };
    saveAuthConfig(updatedConfig);
    return updatedConfig;
  }
}

/**
 * Gets the list of available organizations for the user
 */
export async function listUserOrganizations(): Promise<
  { id: string; name: string }[] | null
> {
  const authConfig = loadAuthConfig();

  // If using CONTINUE_API_KEY environment variable, organization switching is not supported
  if (isEnvironmentAuthConfig(authConfig)) {
    return null;
  }

  if (!isAuthenticatedConfig(authConfig)) {
    return null;
  }

  const apiClient = new DefaultApi(
    new Configuration({
      accessToken: authConfig.accessToken,
    })
  );

  try {
    const resp = await apiClient.listOrganizations();
    return resp.organizations || [];
  } catch (error) {
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
  if (process.env.CONTINUE_API_KEY) {
    console.info(
      chalk.yellow(
        "Using CONTINUE_API_KEY from environment variables, nothing to log out"
      )
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
