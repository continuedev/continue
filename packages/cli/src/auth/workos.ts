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

interface AuthConfig {
  userId?: string;
  userEmail?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

/**
 * Loads the authentication configuration from disk
 */
export function loadAuthConfig(): AuthConfig {
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
    redirect_uri: `${env.appUrl}tokens/${useOnboarding ? "onboarding-" : ""}callback`,
    state: uuidv4(),
    provider: "authkit",
  };

  Object.keys(params).forEach((key) =>
    url.searchParams.append(key, params[key as keyof typeof params]),
  );

  return url.toString();
}
/**
 * Refreshes the access token using a refresh token
 */
async function refreshToken(refreshToken: string): Promise<AuthConfig> {
  try {
    const response = await axios.post(`${env.apiBase}auth/refresh`, {
      refreshToken,
    });

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
      error.response?.data?.message || error.message || error,
    );
    throw error;
  }
}

/**
 * Authenticates using the Continue web flow
 */
export async function login(
  useOnboarding: boolean = false,
): Promise<AuthConfig> {
  try {
    console.log(chalk.cyan("\nStarting authentication with Continue..."));

    // Get auth URL using the direct implementation
    const authUrl = getAuthUrlForTokenPage(useOnboarding);
    console.log(chalk.green(`Opening browser to sign in at: ${authUrl}`));
    await open(authUrl);

    console.log(chalk.yellow("\nAfter signing in, you'll receive a token."));

    // Get token from user
    const token = await prompt(chalk.yellow("Paste your sign-in token here: "));

    console.log(chalk.cyan("Verifying token..."));

    // Exchange token for session
    const response = await refreshToken(token);

    console.log(chalk.green("\nAuthentication successful!"));

    return response;
  } catch (error: any) {
    console.error(
      chalk.red("Authentication error:"),
      error.response?.data?.message || error.message || error,
    );
    throw error;
  }
}

/**
 * Logs the user out by clearing saved credentials
 */
export function logout(): void {
  if (fs.existsSync(AUTH_CONFIG_PATH)) {
    fs.unlinkSync(AUTH_CONFIG_PATH);
    console.log(chalk.green("Successfully logged out"));
  } else {
    console.log(chalk.yellow("No active session found"));
  }
}
