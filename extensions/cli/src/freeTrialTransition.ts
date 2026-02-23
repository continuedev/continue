import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

import chalk from "chalk";
import { setConfigFilePermissions } from "core/util/paths.js";
import open from "open";

import { env } from "./env.js";
import {
  getApiKeyValidationError,
  isValidAnthropicApiKey,
} from "./util/apiKeyValidation.js";
import { gracefulExit } from "./util/exit.js";
import { question, questionWithChoices } from "./util/prompt.js";
import { updateAnthropicModelInYaml } from "./util/yamlConfigUpdater.js";

const CONFIG_PATH = path.join(env.continueHome, "config.yaml");

/**
 * Creates or updates the local config with Anthropic API key
 */
async function createOrUpdateConfig(apiKey: string): Promise<void> {
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

/**
 * Handles the free trial transition flow for users who have maxed out their free trial
 * This function provides a specialized flow that:
 * 1. Assumes the user is already authenticated
 * 2. Provides two specific options for continuing
 * 3. Returns to the chat without restarting the entire CLI
 */
export async function handleMaxedOutFreeTrial(
  onReload?: () => Promise<void>,
): Promise<void> {
  // Clear the screen but don't show ASCII art - keep it minimal since we're resuming a conversation
  console.clear();

  console.log(chalk.yellow("🚀 Free trial limit reached!\n"));
  console.log("Choose how you'd like to Continue:");
  console.log(chalk.white("1. 💳 Sign up for models add-on"));
  console.log(chalk.white("2. 🔑 Enter your Anthropic API key"));

  const choice = await questionWithChoices(
    chalk.yellow("\nEnter choice (1): "),
    ["1", "2", ""],
    "1",
    chalk.dim("Please enter 1 or 2"),
  );

  if (choice === "1" || choice === "") {
    // Option 1: Open models setup page
    const modelsUrl = new URL("setup-models", env.appUrl).toString();
    console.log(chalk.blue(`Opening ${modelsUrl}...`));

    try {
      await open(modelsUrl);
      console.log(chalk.green("\n✓ Browser opened successfully!"));
      console.log(
        chalk.dim(
          "After setting up your models subscription, restart the CLI to continue.",
        ),
      );
    } catch {
      console.log(chalk.yellow("\n⚠ Could not open browser automatically"));
      console.log(chalk.white(`Please visit: ${modelsUrl}`));
      console.log(
        chalk.dim(
          "After setting up your models subscription, restart the CLI to continue.",
        ),
      );
    }

    // Wait for user to acknowledge
    await question(chalk.dim("\nPress Enter to exit..."));
    await gracefulExit(0);
  } else if (choice === "2") {
    // Option 2: Enter Anthropic API key
    const apiKey = await question(
      chalk.white("\nEnter your Anthropic API key: "),
    );

    if (!isValidAnthropicApiKey(apiKey)) {
      console.log(chalk.red(`❌ ${getApiKeyValidationError(apiKey)}`));
      await gracefulExit(1);
    }

    try {
      await createOrUpdateConfig(apiKey);
      console.log(chalk.green(`✓ API key saved successfully!`));
      console.log(chalk.green("✓ Switching to local configuration..."));

      // If a reload callback is provided, use it instead of restarting
      if (onReload) {
        await onReload();
        return;
      }
    } catch (error) {
      console.log(chalk.red(`❌ Error saving API key: ${error}`));
      await gracefulExit(1);
    }
  }

  // Fallback: restart the CLI if no reload callback was provided
  console.log(
    chalk.green(
      "\n🔄 Restarting Continue CLI to resume your conversation...\n",
    ),
  );

  // Get the path to the current script
  const scriptPath = path.resolve(process.argv[1]);

  // Restart the CLI with the same arguments, except for the first two (node and script path)
  // Use spawn instead of spawnSync, since we want to exit this process
  const child = spawn(
    process.execPath,
    [scriptPath, ...process.argv.slice(2)],
    {
      stdio: "inherit",
      detached: true,
    },
  );

  // Unref the child to allow the parent process to exit
  child.unref();

  // Exit the current process
  await gracefulExit(0);
}
