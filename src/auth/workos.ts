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

export interface AuthConfig {
  userId?: string;
  userEmail?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  organizationId?: string | null;
}

/**
 * Loads the authentication configuration from disk
 */
export function loadAuthConfig(): AuthConfig {
  // If CONTINUE_API_KEY environment variable exists, use that instead
  if (process.env.CONTINUE_API_KEY) {
    return {
      accessToken: process.env.CONTINUE_API_KEY,
    };
  }

  try {
    if (fs.existsSync(AUTH_CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(AUTH_CONFIG_PATH, "utf8"));
    }
  } catch (error) {
    console.error(`Error loading auth config: ${error}`);
  }
  return {};
}

/**
 * Saves the authentication configuration to disk
 */
export function saveAuthConfig(config: AuthConfig): void {
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
  // If CONTINUE_API_KEY environment variable exists, user is authenticated
  if (process.env.CONTINUE_API_KEY) {
    return true;
  }

  const config = loadAuthConfig();

  if (!config.userId || !config.accessToken) {
    return false;
  }

  // Check if token is expired (if we have an expiration)
  if (config.expiresAt && Date.now() > config.expiresAt) {
    // Try refreshing the token
    refreshToken(config.refreshToken || "").catch(() => {
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
async function refreshToken(refreshToken: string): Promise<AuthConfig> {
  try {
    const response = await axios.post(
      new URL("auth/refresh", env.apiBase).toString(),
      {
        refreshToken,
      }
    );

    const { accessToken, refreshToken: newRefreshToken, user } = response.data;

    // Calculate token expiration (assuming 1 hour validity)
    const tokenExpiresAt = Date.now() + 60 * 60 * 1000;

    const authConfig: AuthConfig = {
      userId: user.id,
      userEmail: user.email,
      accessToken,
      refreshToken: newRefreshToken,
      expiresAt: tokenExpiresAt,
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
 * Ensures the user has selected an organization, prompting if necessary
 */
export async function ensureOrganization(
  authConfig: AuthConfig,
  isHeadless: boolean = false
): Promise<AuthConfig> {
  // If using CONTINUE_API_KEY environment variable, don't require organization selection
  if (process.env.CONTINUE_API_KEY) {
    return authConfig;
  }

  // If already have organization ID (including null for personal), return as-is
  if (authConfig.organizationId !== undefined) {
    return authConfig;
  }

  // In headless mode, default to personal organization if none saved
  if (isHeadless) {
    const updatedConfig = {
      ...authConfig,
      organizationId: null, // Default to personal organization
    };
    saveAuthConfig(updatedConfig);
    return updatedConfig;
  }

  // Need to select organization
  const apiClient = new DefaultApi(
    new Configuration({
      accessToken: authConfig.accessToken,
    })
  );

  try {
    const resp = await apiClient.listOrganizations();
    const organizations = resp.organizations;

    if (organizations.length === 0) {
      console.info(
        chalk.green("No organizations found. Using personal organization.")
      );
      const updatedConfig = {
        ...authConfig,
        organizationId: null,
      };
      saveAuthConfig(updatedConfig);
      return updatedConfig;
    }

    if (organizations.length === 1) {
      // Show choice between personal and the one organization
      const org = organizations[0];
      console.info(chalk.cyan("\nSelect an organization:"));
      console.info(chalk.white(`1. Personal (default)`));
      console.info(chalk.white(`2. ${org.name}`));

      const selection = await prompt(
        chalk.yellow("Enter your choice (number): ")
      );
      const selectedIndex = parseInt(selection) - 1;

      if (selectedIndex < 0 || selectedIndex > 1) {
        console.error(chalk.red("Invalid selection. Please try again."));
        return await ensureOrganization(authConfig, isHeadless);
      }

      let selectedOrgId: string | null;
      let selectedOrgName: string;

      if (selectedIndex === 0) {
        // Personal organization selected
        selectedOrgId = null;
        selectedOrgName = "Personal";
      } else {
        // The one organization selected
        selectedOrgId = org.id;
        selectedOrgName = org.name;
      }

      console.info(chalk.green(`Selected organization: ${selectedOrgName}`));

      const updatedConfig = {
        ...authConfig,
        organizationId: selectedOrgId,
      };

      saveAuthConfig(updatedConfig);
      return updatedConfig;
    }

    // Multiple organizations - show selection including personal
    console.info(chalk.cyan("\nSelect an organization:"));
    console.info(chalk.white(`1. Personal (default)`));
    organizations.forEach((org, index) => {
      console.info(chalk.white(`${index + 2}. ${org.name}`));
    });

    const selection = await prompt(
      chalk.yellow("Enter your choice (number): ")
    );
    const selectedIndex = parseInt(selection) - 1;

    if (selectedIndex < 0 || selectedIndex > organizations.length) {
      console.error(chalk.red("Invalid selection. Please try again."));
      return await ensureOrganization(authConfig, isHeadless);
    }

    let selectedOrgId: string | null;
    let selectedOrgName: string;

    if (selectedIndex === 0) {
      // Personal organization selected
      selectedOrgId = null;
      selectedOrgName = "Personal";
    } else {
      // Regular organization selected
      const selectedOrg = organizations[selectedIndex - 1];
      selectedOrgId = selectedOrg.id;
      selectedOrgName = selectedOrg.name;
    }
    console.info(chalk.green(`Selected organization: ${selectedOrgName}`));

    const updatedConfig = {
      ...authConfig,
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
    return authConfig;
  }
}

/**
 * Gets the list of available organizations for the user
 */
export async function listUserOrganizations(): Promise<
  { id: string; name: string }[] | null
> {
  // If using CONTINUE_API_KEY environment variable, organization switching is not supported
  if (process.env.CONTINUE_API_KEY) {
    return null;
  }

  const authConfig = loadAuthConfig();

  if (!authConfig.accessToken) {
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
