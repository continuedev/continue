import { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import chalk from "chalk";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as readlineSync from "readline-sync";
import { AuthConfig, isAuthenticated, login } from "./auth/workos.js";
import { initialize } from "./config.js";
import { MCPService } from "./mcp.js";

const CONFIG_PATH = path.join(os.homedir(), ".continue", "config.yaml");

export interface OnboardingResult {
  config: AssistantUnrolled;
  llmApi: BaseLlmApi;
  model: ModelConfig;
  mcpService: MCPService;
  wasOnboarded: boolean;
}

export async function checkHasAcceptableModel(
  configPath: string
): Promise<boolean> {
  try {
    if (!fs.existsSync(configPath)) {
      return false;
    }

    const content = fs.readFileSync(configPath, "utf8");
    return content.includes("claude");
  } catch (error) {
    return false;
  }
}

import * as YAML from "yaml";

export async function createOrUpdateConfig(apiKey: string): Promise<void> {
  const configDir = path.dirname(CONFIG_PATH);

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const newModel = {
    uses: "anthropic/claude-4-sonnet",
    with: {
      ANTHROPIC_API_KEY: apiKey,
    },
  };

  if (fs.existsSync(CONFIG_PATH)) {
    const existingContent = fs.readFileSync(CONFIG_PATH, "utf8");
    let config;

    try {
      config = YAML.parse(existingContent);

      // Make sure models array exists
      if (!config.models) {
        config.models = [];
      }

      // Check if model already exists
      const existingModelIndex = config.models.findIndex(
        (model: any) => model.uses === "anthropic/claude-4-sonnet"
      );

      if (existingModelIndex >= 0) {
        // Update existing model
        config.models[existingModelIndex].with.ANTHROPIC_API_KEY = apiKey;
      } else {
        // Add new model
        config.models.push(newModel);
      }
    } catch (error) {
      // If parsing fails, create a new config
      config = {
        name: "Local Config",
        version: "1.0.0",
        schema: "v1",
        models: [newModel],
      };
    }

    // Write back to file
    fs.writeFileSync(CONFIG_PATH, YAML.stringify(config));
  } else {
    // Create new config file
    const config = {
      name: "Local Config",
      version: "1.0.0",
      schema: "v1",
      models: [newModel],
    };

    fs.writeFileSync(CONFIG_PATH, YAML.stringify(config));
  }
}

export async function runOnboardingFlow(
  configPath: string | undefined,
  authConfig: AuthConfig
): Promise<OnboardingResult> {
  // Step 1: Check if --config flag is provided
  if (configPath) {
    const result = await initialize(authConfig, configPath);
    return { ...result, wasOnboarded: false };
  }

  // Step 2: Present user with two options
  console.log(chalk.yellow("How do you want to get started?"));
  console.log(chalk.white("1. ⏩ Log in with Continue"));
  console.log(chalk.white("2. 🔑 Enter your Anthropic API key"));

  const choice = readlineSync.question(chalk.yellow("\nEnter choice (1): "), {
    limit: ["1", "2", ""],
    limitMessage: chalk.dim("Please enter 1 or 2"),
  });

  if (choice === "1" || choice === "") {
    const newAuthConfig = await login();

    const result = await initialize(newAuthConfig, undefined);
    return { ...result, wasOnboarded: true };
  } else if (choice === "2") {
    const apiKey = readlineSync.question(
      chalk.white("\nEnter your Anthropic API key: "),
      {
        limit: /^sk-ant-.+$/, // Must start with "sk-ant-" and have additional characters
        limitMessage: chalk.dim(
          "Please enter a valid Anthropic key that starts with 'sk-ant'"
        ),
        hideEchoBack: true,
      }
    );

    if (!apiKey || !apiKey.startsWith("sk-ant-")) {
      throw new Error(
        "Invalid Anthropic API key. Please make sure it starts with 'sk-ant-'"
      );
    }

    await createOrUpdateConfig(apiKey);
    console.log(
      chalk.green(`✓ Config file updated successfully at ${CONFIG_PATH}`)
    );

    const result = await initialize(authConfig, CONFIG_PATH);
    return { ...result, wasOnboarded: true };
  } else {
    throw new Error("Invalid choice. Please select 1 or 2.");
  }
}

export async function runNormalFlow(
  configPath: string | undefined,
  authConfig: AuthConfig
): Promise<OnboardingResult> {
  // Step 1: Check if --config flag is provided
  if (configPath) {
    const result = await initialize(authConfig, configPath);
    return { ...result, wasOnboarded: false };
  }

  // Step 2: If user is logged in, look for first assistant in selected org
  if (isAuthenticated()) {
    try {
      const result = await initialize(authConfig, undefined);
      return { ...result, wasOnboarded: false };
    } catch (error) {}
  }

  // Step 3: Look for local ~/.continue/config.yaml
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const result = await initialize(authConfig, CONFIG_PATH);
      return { ...result, wasOnboarded: false };
    } catch (error) {
      console.log(chalk.yellow("⚠ Invalid config file found"));
    }
  }

  // Step 4: Look for ANTHROPIC_API_KEY in environment
  if (process.env.ANTHROPIC_API_KEY) {
    console.log(chalk.blue("✓ Using ANTHROPIC_API_KEY from environment"));
    await createOrUpdateConfig(process.env.ANTHROPIC_API_KEY);
    console.log(chalk.gray(`  Config saved to: ${CONFIG_PATH}`));
    const result = await initialize(authConfig, CONFIG_PATH);
    return { ...result, wasOnboarded: false };
  }

  // Step 5: Fall back to onboarding flow
  return runOnboardingFlow(configPath, authConfig);
}

export async function isFirstTime(): Promise<boolean> {
  return !fs.existsSync(
    path.join(os.homedir(), ".continue", ".onboarding_complete")
  );
}

export async function markOnboardingComplete(): Promise<void> {
  const flagPath = path.join(os.homedir(), ".continue", ".onboarding_complete");
  const flagDir = path.dirname(flagPath);

  if (!fs.existsSync(flagDir)) {
    fs.mkdirSync(flagDir, { recursive: true });
  }

  fs.writeFileSync(flagPath, new Date().toISOString());
}

export async function initializeWithOnboarding(
  authConfig: AuthConfig,
  configPath: string | undefined
): Promise<OnboardingResult> {
  const firstTime = await isFirstTime();

  let result: OnboardingResult;

  if (firstTime) {
    result = await runOnboardingFlow(configPath, authConfig);
    if (result.wasOnboarded) {
      await markOnboardingComplete();
    }
  } else {
    result = await runNormalFlow(configPath, authConfig);
  }

  return result;
}