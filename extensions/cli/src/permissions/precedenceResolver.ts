import { logger } from "../util/logger.js";

import { getDefaultToolPolicies } from "./defaultPolicies.js";
import {
  loadPermissionsYamlResult,
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
  /** ~/.continue/permissions.yaml - third precedence */
  personalSettings?: boolean; // Whether to load from permissions.yaml
  /** Default policies - lowest precedence */
  isHeadless?: boolean;
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
 *
 * If permissions.yaml exists but cannot be parsed, the personal layer fails
 * closed with `{ tool: "*", permission: "ask" }` so headless permissive
 * defaults cannot unlock tools the user intended to restrict.
 */
export function resolvePermissionPrecedence(
  sources: PermissionSources,
): ToolPermissionPolicy[] {
  const policies: ToolPermissionPolicy[] = [];

  // Layer 1: Command line flags (highest precedence)
  if (sources.commandLineFlags) {
    const cliPolicies = commandLineFlagsToPolicies(sources.commandLineFlags);
    policies.push(...cliPolicies);
  }

  // Layer 2: Personal settings from ~/.continue/permissions.yaml
  if (sources.personalSettings !== false) {
    const yamlResult = loadPermissionsYamlResult();
    if (yamlResult.status === "valid") {
      const yamlPolicies = yamlConfigToPolicies(yamlResult.config);
      policies.push(...yamlPolicies);
    } else if (yamlResult.status === "unreadable") {
      // Fail closed: a broken policy file must not fall through to permissive
      // headless defaults (Bash/*: allow). First-match "*": ask shadows them.
      logger.error(
        "permissions.yaml exists but could not be parsed; applying fail-closed ask-all policy instead of permissive defaults",
        {
          reason: yamlResult.reason,
          error: yamlResult.error,
        },
      );
      policies.push({ tool: "*", permission: "ask" });
    }
  }

  // Layer 3: Default policies (lowest precedence)
  if (sources.useDefaults !== false) {
    const defaultPolicies = getDefaultToolPolicies(sources.isHeadless);
    policies.push(...defaultPolicies);
  }

  return policies;
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
