import { ensurePermissionsYamlExists } from "../permissions/permissionsYamlLoader.js";
import { resolvePermissionPrecedence } from "../permissions/precedenceResolver.js";
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
    permissions: { policies: [] }
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
    
    // Use the precedence resolver to get properly ordered policies
    const compiledPolicies = resolvePermissionPrecedence({
      commandLineFlags: runtimeOverrides,
      personalSettings: true, // Enable loading from ~/.continue/permissions.yaml
      useDefaults: true
    });
    
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
    // Ensure permissions.yaml exists before loading
    await ensurePermissionsYamlExists();
    
    // Use the synchronous version after ensuring the file exists
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