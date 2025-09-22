import * as fs from "fs";
import * as path from "path";

import { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import { DefaultApiInterface } from "@continuedev/sdk/dist/api/dist/index.js";
import chalk from "chalk";

import { processPromptOrRule } from "./args.js";
import { AuthConfig, isAuthenticated, login } from "./auth/workos.js";
import { initialize } from "./config.js";
import { env } from "./env.js";
import { MCPService } from "./services/MCPService.js";
import {
  getApiKeyValidationError,
  isValidAnthropicApiKey,
} from "./util/apiKeyValidation.js";
import { question, questionWithChoices } from "./util/prompt.js";
import { updateAnthropicModelInYaml } from "./util/yamlConfigUpdater.js";

const CONFIG_PATH = path.join(env.continueHome, "config.yaml");

export interface OnboardingResult {
  config: AssistantUnrolled;
  llmApi: BaseLlmApi;
  model: ModelConfig;
  mcpService: MCPService;
  apiClient: DefaultApiInterface;
  wasOnboarded: boolean;
}

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
}

async function runOnboardingFlow(
  configPath: string | undefined,
  authConfig: AuthConfig,
): Promise<OnboardingResult> {
  // Step 1: Check if --config flag is provided
  if (configPath !== undefined) {
    const result = await initialize(authConfig, configPath);
    return { ...result, wasOnboarded: false };
  }

  // Step 2: Check if we're in a test/CI environment - if so, skip interactive prompts
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
      const result = await initialize(authConfig, CONFIG_PATH);
      return { ...result, wasOnboarded: false };
    }

    // Otherwise return a minimal working configuration
    const result = await initialize(authConfig, undefined);
    return { ...result, wasOnboarded: false };
  }

  // Step 3: Present user with two options
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
    const newAuthConfig = await login();

    const { ensureOrganization } = await import("./auth/workos.js");
    const finalAuthConfig = await ensureOrganization(newAuthConfig);

    const result = await initialize(finalAuthConfig, undefined);
    return { ...result, wasOnboarded: true };
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

    const result = await initialize(authConfig, CONFIG_PATH);
    return { ...result, wasOnboarded: true };
  } else {
    throw new Error("Invalid choice. Please select 1 or 2.");
  }
}

export async function runNormalFlow(
  authConfig: AuthConfig,
  configPath?: string,
  rules?: string[],
): Promise<OnboardingResult> {
  // Step 1: Check if --config flag is provided
  if (configPath !== undefined) {
    // Empty string is invalid and should be treated as an error
    if (configPath === "") {
      throw new Error(
        `Failed to load config from "": Config path cannot be empty`,
      );
    }

    try {
      const result = await initialize(authConfig, configPath);
      // Inject rules into the config if provided
      if (rules && rules.length > 0) {
        result.config = await injectRulesIntoConfig(result.config, rules);
      }
      return { ...result, wasOnboarded: false };
    } catch (error) {
      // If user explicitly provided --config flag, fail loudly instead of falling back
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to load config from "${configPath}": ${errorMessage}`,
      );
    }
  }

  // Step 2: If user is logged in, look for first assistant in selected org
  if (isAuthenticated()) {
    try {
      const result = await initialize(authConfig, undefined);
      // Inject rules into the config if provided
      if (rules && rules.length > 0) {
        result.config = await injectRulesIntoConfig(result.config, rules);
      }
      return { ...result, wasOnboarded: false };
    } catch {
      // Silently ignore errors when loading default assistant
    }
  }

  // Step 3: Look for local ~/.continue/config.yaml
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const result = await initialize(authConfig, CONFIG_PATH);
      // Inject rules into the config if provided
      if (rules && rules.length > 0) {
        result.config = await injectRulesIntoConfig(result.config, rules);
      }
      return { ...result, wasOnboarded: false };
    } catch {
      console.log(chalk.yellow("⚠ Invalid config file found"));
    }
  }

  // Step 4: Look for ANTHROPIC_API_KEY in environment
  if (process.env.ANTHROPIC_API_KEY) {
    console.log(chalk.blue("✓ Using ANTHROPIC_API_KEY from environment"));
    await createOrUpdateConfig(process.env.ANTHROPIC_API_KEY);
    console.log(chalk.gray(`  Config saved to: ${CONFIG_PATH}`));
    const result = await initialize(authConfig, CONFIG_PATH);
    // Inject rules into the config if provided
    if (rules && rules.length > 0) {
      result.config = await injectRulesIntoConfig(result.config, rules);
    }
    return { ...result, wasOnboarded: false };
  }

  // Step 5: Fall back to onboarding flow
  return runOnboardingFlow(configPath, authConfig);
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

/**
 * Process rules and inject them into the assistant config
 * @param config - The assistant config to modify
 * @param rules - Array of rule specifications to process and inject
 * @returns The modified config with injected rules
 */
async function injectRulesIntoConfig(
  config: AssistantUnrolled,
  rules: string[],
): Promise<AssistantUnrolled> {
  if (!rules || rules.length === 0) {
    return config;
  }

  const processedRules: string[] = [];
  for (const ruleSpec of rules) {
    try {
      const processedRule = await processPromptOrRule(ruleSpec);
      processedRules.push(processedRule);
    } catch (error: any) {
      console.warn(
        chalk.yellow(
          `Warning: Failed to process rule "${ruleSpec}": ${error.message}`,
        ),
      );
    }
  }

  if (processedRules.length === 0) {
    return config;
  }

  // Clone the config to avoid mutating the original
  const modifiedConfig = { ...config };

  // Add processed rules to the config's rules array
  // Each processed rule is a string, which is a valid Rule type
  const existingRules = modifiedConfig.rules || [];
  modifiedConfig.rules = [...existingRules, ...processedRules];

  return modifiedConfig;
}

export async function initializeWithOnboarding(
  authConfig: AuthConfig,
  configPath: string | undefined,
  rules?: string[],
): Promise<OnboardingResult> {
  const firstTime = await isFirstTime();

  let result: OnboardingResult;

  if (firstTime) {
    result = await runOnboardingFlow(configPath, authConfig);
    if (result.wasOnboarded) {
      await markOnboardingComplete();
    }
  } else {
    result = await runNormalFlow(authConfig, configPath, rules);
  }

  // Inject rules into the config if provided (for onboarding flow which doesn't handle rules directly)
  if (rules && rules.length > 0 && !result.wasOnboarded) {
    result.config = await injectRulesIntoConfig(result.config, rules);
  }

  return result;
}
