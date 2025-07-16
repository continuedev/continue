import {
  Configuration,
  DefaultApi,
} from "@continuedev/sdk/dist/api/dist/index.js";
import axios from "axios";
import chalk from "chalk";
import * as fs from "fs";
import open from "open";
import * as os from "os";
import * as path from "path";
import { createInterface } from "readline";
import { v4 as uuidv4 } from "uuid";
import { env } from "../env.js";

// Config file path
const AUTH_CONFIG_PATH = path.join(os.homedir(), ".continue", "auth.json");

// Represents an authenticated user's configuration
export interface AuthenticatedConfig {
  userId: string;
  userEmail: string;
  userSlug: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  organizationId: string | null; // null means personal organization
}

// Represents configuration when using environment variable auth
export interface EnvironmentAuthConfig {
  accessToken: string;
  organizationId: null; // Environment auth always uses personal organization
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
        data.userSlug &&
        data.accessToken &&
        data.refreshToken &&
        data.expiresAt
      ) {
        return {
          userId: data.userId,
          userEmail: data.userEmail,
          userSlug: data.userSlug,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresAt: data.expiresAt,
          organizationId: data.organizationId || null,
        };
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
 * Gets the auth URL for the token page
 */
function getAuthUrlForTokenPage(useOnboarding: boolean = false): string {
  const url = new URL("https://api.workos.com/user_management/authorize");
  const params = {
    response_type: "code",
    client_id: env.workOsClientId,
    redirect_uri: `${env.appUrl}/tokens/${
      useOnboarding ? "onboarding-" : ""
    }callback/cli`,
    state: uuidv4(),
    provider: "authkit",
  };

  Object.keys(params).forEach((key) =>
    url.searchParams.append(key, params[key as keyof typeof params])
  );

  return url.toString();
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

    const response = await axios.post(
      new URL("auth/refresh", env.apiBase).toString(),
      {
        refreshToken,
      }
    );

    const { accessToken, refreshToken: newRefreshToken, user } = response.data;

    // Calculate token expiration (assuming 1 hour validity)
    const tokenExpiresAt = Date.now() + 60 * 60 * 1000;

    const authConfig: AuthenticatedConfig = {
      userId: user.id,
      userEmail: user.email,
      userSlug: user.slug,
      accessToken,
      refreshToken: newRefreshToken,
      expiresAt: tokenExpiresAt,
      // Preserve existing organizationId if it exists, otherwise set to null
      organizationId: isAuthenticatedConfig(existingConfig)
        ? existingConfig.organizationId
        : null,
    };

    // Save the config
    saveAuthConfig(authConfig);

    return authConfig;
  } catch (error: any) {
    console.error(
      chalk.red("Token refresh error:"),
      error.response?.data?.message || error.message || error
    );
    throw error;
  }
}

/**
 * Authenticates using the Continue web flow
 */
export async function login(
  useOnboarding: boolean = false
): Promise<AuthConfig> {
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

    // Get auth URL using the direct implementation
    const authUrl = getAuthUrlForTokenPage(useOnboarding);
    console.info(chalk.green(`Opening browser to sign in at: ${authUrl}`));
    await open(authUrl);

    console.info(chalk.yellow("\nAfter signing in, you'll receive a token."));

    // Get token from user
    const token = await prompt(chalk.yellow("Paste your sign-in token here: "));

    console.info(chalk.cyan("Verifying token..."));

    // Exchange token for session
    const response = await refreshToken(token);

    console.info(chalk.green("\nAuthentication successful!"));

    return response;
  } catch (error: any) {
    console.error(
      chalk.red("Authentication error:"),
      error.response?.data?.message || error.message || error
    );
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
      userSlug: authenticatedConfig.userSlug,
      accessToken: authenticatedConfig.accessToken,
      refreshToken: authenticatedConfig.refreshToken,
      expiresAt: authenticatedConfig.expiresAt,
      organizationId: null, // Default to personal organization
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
        userSlug: authenticatedConfig.userSlug,
        accessToken: authenticatedConfig.accessToken,
        refreshToken: authenticatedConfig.refreshToken,
        expiresAt: authenticatedConfig.expiresAt,
        organizationId: null,
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
      userSlug: authenticatedConfig.userSlug,
      accessToken: authenticatedConfig.accessToken,
      refreshToken: authenticatedConfig.refreshToken,
      expiresAt: authenticatedConfig.expiresAt,
      organizationId: selectedOrgId,
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
      userSlug: authenticatedConfig.userSlug,
      accessToken: authenticatedConfig.accessToken,
      refreshToken: authenticatedConfig.refreshToken,
      expiresAt: authenticatedConfig.expiresAt,
      organizationId: null,
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
