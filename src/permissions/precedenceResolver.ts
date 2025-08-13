import { logger } from "../util/logger.js";

import { DEFAULT_TOOL_POLICIES } from "./defaultPolicies.js";
import {
  loadPermissionsYaml,
  yamlConfigToPolicies,
} from "./permissionsYamlLoader.js";
import { type ToolPermissionPolicy } from "./types.js";

export interface PermissionSources {
  /** Command line flags - highest precedence */
  commandLineFlags?: {
    allow?: string[];
    ask?: string[];
    exclude?: string[];
  };
  /** Config.yaml permissions - second precedence (not implemented yet) */
  configPermissions?: ToolPermissionPolicy[];
  /** ~/.continue/permissions.yaml - third precedence */
  personalSettings?: boolean; // Whether to load from permissions.yaml
  /** Default policies - lowest precedence */
  useDefaults?: boolean;
}

/**
 * Resolves permission policies from all sources according to precedence rules.
 * This function implements the clean precedence logic from the specification:
 *
 * 1. Command line flags (highest)
 * 2. Permissions in config.yaml (when implemented)
 * 3. Permissions in ~/.continue/permissions.yaml
 * 4. Default policies (lowest)
 *
 * Earlier sources completely override later ones on a per-tool basis.
 */
export function resolvePermissionPrecedence(
  sources: PermissionSources,
): ToolPermissionPolicy[] {
  const layers: {
    name: string;
    policies: ToolPermissionPolicy[];
  }[] = [];

  // Layer 4: Default policies (lowest precedence)
  if (sources.useDefaults !== false) {
    layers.push({
      name: "defaults",
      policies: [...DEFAULT_TOOL_POLICIES],
    });
  }

  // Layer 3: Personal settings from ~/.continue/permissions.yaml
  if (sources.personalSettings !== false) {
    const yamlConfig = loadPermissionsYaml();
    if (yamlConfig) {
      const yamlPolicies = yamlConfigToPolicies(yamlConfig);
      if (yamlPolicies.length > 0) {
        layers.push({
          name: "personal-settings",
          policies: yamlPolicies,
        });
      }
    }
  }

  // Layer 2: Config permissions (when implemented)
  if (sources.configPermissions) {
    layers.push({
      name: "config",
      policies: sources.configPermissions,
    });
  }

  // Layer 1: Command line flags (highest precedence)
  if (sources.commandLineFlags) {
    const cliPolicies = commandLineFlagsToPolicies(sources.commandLineFlags);
    if (cliPolicies.length > 0) {
      layers.push({
        name: "cli-flags",
        policies: cliPolicies,
      });
    }
  }

  // Combine layers with proper precedence
  const combinedPolicies = combineLayersWithPrecedence(layers);

  logger.debug("Resolved permission precedence", {
    layers: layers.map((l) => ({ name: l.name, count: l.policies.length })),
    totalPolicies: combinedPolicies.length,
  });

  return combinedPolicies;
}

/**
 * Converts command line flags to policies
 */
function commandLineFlagsToPolicies(flags: {
  allow?: string[];
  ask?: string[];
  exclude?: string[];
}): ToolPermissionPolicy[] {
  const policies: ToolPermissionPolicy[] = [];

  // Order matters for CLI flags too
  if (flags.exclude) {
    for (const tool of flags.exclude) {
      const normalizedName = tool;
      policies.push({ tool: normalizedName, permission: "exclude" });
    }
  }

  if (flags.ask) {
    for (const tool of flags.ask) {
      const normalizedName = tool;
      policies.push({ tool: normalizedName, permission: "ask" });
    }
  }

  if (flags.allow) {
    for (const tool of flags.allow) {
      const normalizedName = tool;
      policies.push({ tool: normalizedName, permission: "allow" });
    }
  }

  return policies;
}

/**
 * Combines permission layers with proper precedence.
 * Higher precedence layers come later in the array and are prepended to the result.
 */
function combineLayersWithPrecedence(
  layers: Array<{ name: string; policies: ToolPermissionPolicy[] }>,
): ToolPermissionPolicy[] {
  // Start with empty array
  let combined: ToolPermissionPolicy[] = [];

  // Add layers in order (lowest to highest precedence)
  // Since we're building from lowest to highest, and we want first-match-wins,
  // we prepend higher precedence policies
  for (const layer of layers) {
    // Prepend this layer's policies (higher precedence at the front)
    combined = [...layer.policies, ...combined];
  }

  return combined;
}
