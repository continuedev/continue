import fs from "fs";

import YAML from "yaml";

import { logger } from "../util/logger.js";

import {
  PERMISSIONS_YAML_PATH,
  PermissionsYamlConfig,
  loadPermissionsYaml,
} from "./permissionsYamlLoader.js";

/**
 * Generates a policy rule for a given tool call
 * For most tools, returns the display name (e.g., "Read", "Write")
 * For Bash tool, generates command-specific patterns like "Bash(ls*)"
 */
export function generatePolicyRule(toolName: string, toolArgs: any): string {
  const normalizedName = toolName;

  // For Bash tool, create command-specific policies
  if (normalizedName === "Bash" && toolArgs?.command) {
    const command = toolArgs.command.trim();
    // Extract the first command (before pipes, &&, ||, etc.)
    const firstCommand = command.split(/[;&|]|&&|\|\|/)[0]?.trim();
    if (firstCommand) {
      // Extract just the command name (before spaces or flags)
      const commandName = firstCommand.split(/\s+/)[0];
      return `Bash(${commandName}*)`;
    }
  }

  // For all other tools, return the display name
  return normalizedName;
}

/**
 * Adds a policy rule to the permissions.yaml file
 */
export async function addPolicyToYaml(policyRule: string): Promise<void> {
  try {
    // Load existing config or create empty one
    const config: PermissionsYamlConfig = loadPermissionsYaml() || {};

    // Ensure allow array exists
    if (!config.allow) {
      config.allow = [];
    }

    // Add the policy if it doesn't already exist
    if (config.allow.includes(policyRule)) {
      logger.debug(`Policy rule already exists: ${policyRule}`);
    } else {
      config.allow.push(policyRule);

      // Write the updated config back to the file
      const yamlContent = YAML.stringify(config);

      // Add header comment
      const finalContent = `# Continue CLI Permissions Configuration
# This file is managed by the Continue CLI and should not be edited manually.
# Use the TUI to modify permissions interactively.

${yamlContent}`;

      await fs.promises.writeFile(PERMISSIONS_YAML_PATH, finalContent, "utf-8");
      logger.info(`Added policy rule to permissions.yaml: ${policyRule}`);
    }
  } catch (error) {
    logger.error("Failed to add policy to permissions.yaml", {
      error,
      policyRule,
    });
    throw error;
  }
}
