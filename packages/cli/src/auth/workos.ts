import axios from "axios";
import chalk from "chalk";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { createInterface } from "readline";
// Config file path
const AUTH_CONFIG_PATH = path.join(os.homedir(), ".continue", "auth.json");
// Your application's client ID (this is public information)
const clientId = process.env.WORKOS_CLIENT_ID;
// Your backend API URL that will handle the WorkOS authentication
const authApiUrl =
  process.env.AUTH_API_URL || "https://your-backend-api.com/auth";

interface AuthConfig {
  userId?: string;
  userEmail?: string;
  accessToken?: string;
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
    return false;
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
 * Authenticates using WorkOS Magic Auth
 * This implementation relies on a backend service that manages the WorkOS API key
 */
export async function loginWithMagicAuth(): Promise<AuthConfig> {
  try {
    console.log(
      chalk.cyan("\nStarting authentication with WorkOS Magic Auth..."),
    );

    // Get user email
    const email = await prompt(chalk.yellow("Enter your email: "));

    // Request magic link/code through your backend service
    console.log(chalk.cyan("Requesting authentication code..."));
    await axios.post(`${authApiUrl}/generate-magic-auth`, {
      email,
      clientId,
    });

    console.log(
      chalk.green(`\nMagic link sent to ${email}. Please check your email.`),
    );
    console.log(chalk.cyan("You can also enter the code manually below."));
    // Get verification code
    const code = await prompt(
      chalk.yellow("Enter the verification code from your email: "),
    );

    // Verify the code through your backend service
    console.log(chalk.cyan("Verifying authentication code..."));
    const response = await axios.post(`${authApiUrl}/verify-magic-auth`, {
      email,
      code,
      clientId,
    });

    // Extract user and token info from the response
    const { user, accessToken, expiresIn } = response.data;

    console.log(chalk.green("\nAuthentication successful!"));

    // Calculate token expiration
    const tokenExpiresAt = Date.now() + expiresIn * 1000;
    const authConfig: AuthConfig = {
      userId: user.id,
      userEmail: user.email,
      accessToken: accessToken,
      expiresAt: tokenExpiresAt,
    };

    // Save the config
    saveAuthConfig(authConfig);

    return authConfig;
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
