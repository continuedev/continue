/**
 * Runtime permission overrides that are set synchronously from command line
 * This ensures they're available immediately, before services are initialized
 */

import { ToolPermissionPolicy } from "./types.js";

let runtimeOverrides: ToolPermissionPolicy[] | null = null;

export function setRuntimePermissionOverrides(overrides: {
  allow?: string[];
  ask?: string[];
  exclude?: string[];
}) {
  if (!overrides.allow && !overrides.ask && !overrides.exclude) {
    runtimeOverrides = null;
    return;
  }

  const policies: ToolPermissionPolicy[] = [];

  // Convert runtime overrides to policies
  if (overrides.exclude) {
    for (const tool of overrides.exclude) {
      const normalizedName = tool;
      policies.push({ tool: normalizedName, permission: "exclude" });
    }
  }

  if (overrides.ask) {
    for (const tool of overrides.ask) {
      const normalizedName = tool;
      policies.push({ tool: normalizedName, permission: "ask" });
    }
  }

  if (overrides.allow) {
    for (const tool of overrides.allow) {
      const normalizedName = tool;
      policies.push({ tool: normalizedName, permission: "allow" });
    }
  }

  runtimeOverrides = policies;
}

export function getRuntimePermissionOverrides(): ToolPermissionPolicy[] | null {
  return runtimeOverrides;
}
