import { DEFAULT_TOOL_POLICIES } from "../permissions/defaultPolicies.js";
import { normalizeToolName } from "../permissions/toolNameMapping.js";
import { ToolPermissionPolicy, ToolPermissions } from "../permissions/types.js";
import logger from "../util/logger.js";

export interface ToolPermissionServiceState {
  permissions: ToolPermissions;
}

/**
 * Service for managing tool permissions with a single source of truth
 */
export class ToolPermissionService {
  private state: ToolPermissionServiceState = {
    permissions: { policies: [...DEFAULT_TOOL_POLICIES] }
  };

  /**
   * Synchronously initialize with runtime overrides
   * Used for immediate availability of command-line permission overrides
   */
  initializeSync(runtimeOverrides?: {
    allow?: string[];
    ask?: string[];
    exclude?: string[];
  }): ToolPermissionServiceState {
    logger.debug("Synchronously initializing ToolPermissionService", {
      hasOverrides: !!runtimeOverrides
    });
    
    // Start with default policies
    const compiledPolicies: ToolPermissionPolicy[] = [...DEFAULT_TOOL_POLICIES];
    
    // Apply runtime overrides if provided
    if (runtimeOverrides) {
      const overridePolicies: ToolPermissionPolicy[] = [];
      
      // Convert runtime overrides to policies
      if (runtimeOverrides.allow) {
        for (const tool of runtimeOverrides.allow) {
          const normalizedName = normalizeToolName(tool);
          overridePolicies.push({ tool: normalizedName, permission: "allow" });
        }
      }
      
      if (runtimeOverrides.ask) {
        for (const tool of runtimeOverrides.ask) {
          const normalizedName = normalizeToolName(tool);
          overridePolicies.push({ tool: normalizedName, permission: "ask" });
        }
      }
      
      if (runtimeOverrides.exclude) {
        for (const tool of runtimeOverrides.exclude) {
          const normalizedName = normalizeToolName(tool);
          overridePolicies.push({ tool: normalizedName, permission: "exclude" });
        }
      }
      
      // Prepend override policies (they take precedence)
      compiledPolicies.unshift(...overridePolicies);
    }
    
    this.state = {
      permissions: { policies: compiledPolicies }
    };
    
    return this.state;
  }

  /**
   * Initialize the tool permission service with runtime overrides (async version)
   */
  async initialize(runtimeOverrides?: {
    allow?: string[];
    ask?: string[];
    exclude?: string[];
  }): Promise<ToolPermissionServiceState> {
    // Just use the synchronous version
    return this.initializeSync(runtimeOverrides);
  }

  /**
   * Get the current permission state
   */
  getState(): ToolPermissionServiceState {
    return this.state;
  }

  /**
   * Get the compiled permissions
   */
  getPermissions(): ToolPermissions {
    return this.state.permissions;
  }

  /**
   * Update permissions (e.g., when config changes)
   */
  updatePermissions(newPolicies: ToolPermissionPolicy[]) {
    this.state = {
      permissions: { policies: newPolicies }
    };
    logger.debug(`Updated tool permissions with ${newPolicies.length} policies`);
  }
}