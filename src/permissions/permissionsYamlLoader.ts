import fs from "fs";
import path from "path";

import YAML from "yaml";

import { env } from "../env.js";
import { logger } from "../util/logger.js";

import { PermissionPolicy, ToolPermissionPolicy } from "./types.js";

export const PERMISSIONS_YAML_PATH = path.resolve(
  path.join(env.continueHome, "permissions.yaml"),
);

export interface PermissionsYamlConfig {
  allow?: string[];
  ask?: string[];
  exclude?: string[];
}

/**
 * Loads permissions from ~/.continue/permissions.yaml
 * Returns null if file doesn't exist or can't be parsed
 */
export function loadPermissionsYaml(): PermissionsYamlConfig | null {
  try {
    if (!fs.existsSync(PERMISSIONS_YAML_PATH)) {
      logger.debug("Permissions YAML file does not exist", {
        path: PERMISSIONS_YAML_PATH,
      });
      return null;
    }

    const content = fs.readFileSync(PERMISSIONS_YAML_PATH, "utf-8");
    const parsed = YAML.parse(content) as PermissionsYamlConfig;

    // Validate the structure
    if (parsed && typeof parsed === "object") {
      const validKeys = ["allow", "ask", "exclude"];
      const hasValidStructure = Object.keys(parsed).every(
        (key) =>
          validKeys.includes(key) &&
          (!parsed[key as keyof PermissionsYamlConfig] ||
            Array.isArray(parsed[key as keyof PermissionsYamlConfig])),
      );

      if (hasValidStructure) {
        logger.debug("Loaded permissions from YAML", {
          allow: parsed.allow?.length || 0,
          ask: parsed.ask?.length || 0,
          exclude: parsed.exclude?.length || 0,
        });
        return parsed;
      }
    }

    logger.warn("Invalid permissions YAML structure", {
      path: PERMISSIONS_YAML_PATH,
    });
    return null;
  } catch (error) {
    logger.error("Failed to load permissions YAML", {
      error,
      path: PERMISSIONS_YAML_PATH,
    });
    return null;
  }
}

/**
 * Parses a pattern string into a ToolPermissionPolicy
 * Supports formats like:
 * - "Write" -> { tool: "Write", permission }
 * - "Write(pattern)" -> { tool: "Write", permission, argumentMatches: { file_path: "pattern" } }
 * - "Bash(npm install)" -> { tool: "Bash", permission, argumentMatches: { command: "npm install" } }
 */
export function parseToolPattern(
  pattern: string,
  permission: PermissionPolicy,
): ToolPermissionPolicy {
  const match = pattern.match(/^([^(]+)(?:\(([^)]*)\))?$/);
  if (!match) {
    throw new Error(`Invalid tool pattern: ${pattern}`);
  }

  const [, toolName, args] = match;
  const normalizedName = toolName.trim();

  const policy: ToolPermissionPolicy = {
    tool: normalizedName,
    permission,
  };

  if (args) {
    const trimmedArgs = args.trim();
    if (trimmedArgs) {
      // Map tool names to their primary argument parameter
      const toolArgMappings: Record<string, string> = {
        Write: "file_path",
        Edit: "file_path",
        Read: "file_path",
        List: "path",
        Search: "query",
        Bash: "command",
        Fetch: "url",
        Diff: "file_path",
      };

      const argKey = toolArgMappings[normalizedName] || "pattern";
      policy.argumentMatches = {
        [argKey]: trimmedArgs,
      };
    }
  }

  return policy;
}

/**
 * Converts permissions YAML config to ToolPermissionPolicy array
 */
export function yamlConfigToPolicies(
  config: PermissionsYamlConfig,
): ToolPermissionPolicy[] {
  const policies: ToolPermissionPolicy[] = [];

  // Order matters: more restrictive policies first
  if (config.exclude) {
    for (const pattern of config.exclude) {
      policies.push(parseToolPattern(pattern, "exclude"));
    }
  }

  if (config.ask) {
    for (const pattern of config.ask) {
      policies.push(parseToolPattern(pattern, "ask"));
    }
  }

  if (config.allow) {
    for (const pattern of config.allow) {
      policies.push(parseToolPattern(pattern, "allow"));
    }
  }

  return policies;
}

/**
 * Creates the permissions.yaml file with default content if it doesn't exist
 */
export async function ensurePermissionsYamlExists(): Promise<void> {
  const dir = path.dirname(PERMISSIONS_YAML_PATH);

  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true });
  }

  // Create file if it doesn't exist
  if (!fs.existsSync(PERMISSIONS_YAML_PATH)) {
    const defaultContent = `# cn tool permissions

# Tools that are automatically allowed without prompting
allow: []

# Tools that require user confirmation before execution
ask: []

# Tools that are completely excluded (model won't know they exist)
exclude: []
`;

    await fs.promises.writeFile(PERMISSIONS_YAML_PATH, defaultContent, "utf-8");
    logger.info("Created default permissions.yaml", {
      path: PERMISSIONS_YAML_PATH,
    });
  }
}
