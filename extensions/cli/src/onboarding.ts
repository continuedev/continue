import * as fs from "fs";
import * as path from "path";

import chalk from "chalk";
import { setConfigFilePermissions } from "core/util/paths.js";

import { AuthConfig, login } from "./auth/workos.js";
import { getApiClient } from "./config.js";
import { loadConfiguration } from "./configLoader.js";
import { env } from "./env.js";
import {
  getApiKeyValidationError,
  isValidAnthropicApiKey,
} from "./util/apiKeyValidation.js";
import { question, questionWithChoices } from "./util/prompt.js";
import { updateAnthropicModelInYaml } from "./util/yamlConfigUpdater.js";

const CONFIG_PATH = path.join(env.continueHome, "config.yaml");

export async function checkHasAcceptableModel(
  configPath: string,
): Promise<boolean> {
  try {
    if (!fs.existsSync(configPath)) {
      return false;
    }

    const content = fs.readFileSync(configPath, "utf8");
    return content.includes("claude");
  } catch {
    return false;
  }
}

export async function createOrUpdateConfig(apiKey: string): Promise<void> {
  const configDir = path.dirname(CONFIG_PATH);

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const existingContent = fs.existsSync(CONFIG_PATH)
    ? fs.readFileSync(CONFIG_PATH, "utf8")
    : "";

  const updatedContent = updateAnthropicModelInYaml(existingContent, apiKey);
  fs.writeFileSync(CONFIG_PATH, updatedContent);
  setConfigFilePermissions(CONFIG_PATH);
}

export async function runOnboardingFlow(
  configPath: string | undefined,
): Promise<boolean> {
  // Step 1: Check if --config flag is provided
  if (configPath !== undefined) {
    return false;
  }

  // Step 2: Check for CONTINUE_USE_BEDROCK environment variable first (before test env check)
  if (process.env.CONTINUE_USE_BEDROCK === "1") {
    console.log(
      chalk.blue("✓ Using AWS Bedrock (CONTINUE_USE_BEDROCK detected)"),
    );
    return true;
  }

  // Step 3: Check if we're in a test/CI environment - if so, skip interactive prompts
  const isTestEnv =
    process.env.NODE_ENV === "test" ||
    process.env.CI === "true" ||
    process.env.VITEST === "true" ||
    process.env.GITHUB_ACTIONS === "true" ||
    !process.stdin.isTTY;

  if (isTestEnv) {
    // In test/CI environment, check for ANTHROPIC_API_KEY first
    if (process.env.ANTHROPIC_API_KEY) {
      console.log(chalk.blue("✓ Using ANTHROPIC_API_KEY from environment"));
      await createOrUpdateConfig(process.env.ANTHROPIC_API_KEY);
      console.log(chalk.gray(`  Config saved to: ${CONFIG_PATH}`));
      return false;
    }

    // Otherwise return a minimal working configuration
    return false;
  }

  // Step 4: Present user with two options
  console.log(chalk.yellow("How do you want to get started?"));
  console.log(chalk.white("1. ⏩ Log in with Continue"));
  console.log(chalk.white("2. 🔑 Enter your Anthropic API key"));

  const choice = await questionWithChoices(
    chalk.yellow("\nEnter choice (1): "),
    ["1", "2", ""],
    "1",
    chalk.dim("Please enter 1 or 2"),
  );

  if (choice === "1" || choice === "") {
    await login();
    return true;
  } else if (choice === "2") {
    const apiKey = await question(
      chalk.white("\nEnter your Anthropic API key: "),
    );

    if (!isValidAnthropicApiKey(apiKey)) {
      throw new Error(getApiKeyValidationError(apiKey));
    }

    await createOrUpdateConfig(apiKey);
    console.log(
      chalk.green(`✓ Config file updated successfully at ${CONFIG_PATH}`),
    );

    return true;
  } else {
    throw new Error(`Invalid choice. Please select "1" or "2"`);
  }
}

export async function isFirstTime(): Promise<boolean> {
  return !fs.existsSync(path.join(env.continueHome, ".onboarding_complete"));
}

export async function markOnboardingComplete(): Promise<void> {
  const flagPath = path.join(env.continueHome, ".onboarding_complete");
  const flagDir = path.dirname(flagPath);

  if (!fs.existsSync(flagDir)) {
    fs.mkdirSync(flagDir, { recursive: true });
  }

  fs.writeFileSync(flagPath, new Date().toISOString());
}

export async function initializeWithOnboarding(
  authConfig: AuthConfig,
  configPath: string | undefined,
) {
  const firstTime = await isFirstTime();

  if (configPath !== undefined) {
    // throw an early error is configPath is invalid or has errors
    try {
      await loadConfiguration(
        authConfig,
        configPath,
        getApiClient(authConfig?.accessToken),
        [],
        false,
      );
    } catch (errorMessage) {
      throw new Error(
        `Failed to load config from "${configPath}": ${errorMessage}`,
      );
    }
  }

  if (!firstTime) return;

  const wasOnboarded = await runOnboardingFlow(configPath);
  if (wasOnboarded) {
    await markOnboardingComplete();
  }
}
