import { ensurePermissionsYamlExists } from "../permissions/permissionsYamlLoader.js";
import { resolvePermissionPrecedence } from "../permissions/precedenceResolver.js";
import {
  PermissionMode,
  ToolPermissionPolicy,
  ToolPermissions,
} from "../permissions/types.js";
import { logger } from "../util/logger.js";

import { BaseService } from "./BaseService.js";

export interface ToolPermissionServiceState {
  permissions: ToolPermissions;
  currentMode: PermissionMode;
  isHeadless: boolean;
  modePolicyCount?: number; // Track how many policies are from mode vs other sources
  originalPolicies?: ToolPermissions; // Store original policies when switching modes
}

/**
 * Service for managing tool permissions with a single source of truth
 */
export class ToolPermissionService extends BaseService<ToolPermissionServiceState> {
  constructor() {
    super("ToolPermissionService", {
      permissions: { policies: [] },
      currentMode: "normal",
      isHeadless: false,
      modePolicyCount: 0,
    });
  }

  /**
   * Generate mode-specific policies based on the current mode
   */
  private generateModePolicies(): ToolPermissionPolicy[] {
    switch (this.currentState.currentMode) {
      case "plan":
        // Plan mode: Complete override - exclude all write operations, allow only reads and bash
        return [
          // Exclude all write tools with absolute priority
          { tool: "Write", permission: "exclude" },
          { tool: "Edit", permission: "exclude" },
          { tool: "MultiEdit", permission: "exclude" },
          { tool: "NotebookEdit", permission: "exclude" },
          // Allow all read tools and bash
          { tool: "Bash", permission: "allow" },
          { tool: "Read", permission: "allow" },
          { tool: "List", permission: "allow" },
          { tool: "Search", permission: "allow" },
          { tool: "Fetch", permission: "allow" },
          { tool: "Diff", permission: "allow" },
          { tool: "Checklist", permission: "allow" },
          { tool: "NotebookRead", permission: "allow" },
          { tool: "LS", permission: "allow" },
          { tool: "Glob", permission: "allow" },
          { tool: "Grep", permission: "allow" },
          { tool: "WebFetch", permission: "allow" },
          { tool: "WebSearch", permission: "allow" },
          // Allow MCP tools (assume they're read-only by nature)
          { tool: "mcp:*", permission: "allow" },
          // Default: exclude everything else to ensure no writes
          { tool: "*", permission: "exclude" },
        ];

      case "auto":
        // Auto mode: Complete override - allow everything without asking
        return [{ tool: "*", permission: "allow" }];

      case "normal":
      default:
        // Normal mode: No mode policies, use existing configuration
        return [];
    }
  }

  /**
   * Synchronously initialize with runtime overrides
   * Used for immediate availability of command-line permission overrides
   */
  initializeSync(runtimeOverrides?: {
    allow?: string[];
    ask?: string[];
    exclude?: string[];
    mode?: PermissionMode;
    isHeadless?: boolean;
  }): ToolPermissionServiceState {
    logger.debug("Synchronously initializing ToolPermissionService");

    // Set mode from overrides or default
    if (runtimeOverrides?.mode) {
      this.setState({ currentMode: runtimeOverrides.mode });
    }

    // Set headless flag from overrides
    if (runtimeOverrides?.isHeadless !== undefined) {
      this.setState({ isHeadless: runtimeOverrides.isHeadless });
    }

    // Generate mode-specific policies first (highest priority)
    const modePolicies = this.generateModePolicies();

    // For plan and auto modes, use ONLY mode policies (absolute override)
    // For normal mode, combine with user configuration
    let allPolicies: ToolPermissionPolicy[];
    if (
      this.currentState.currentMode === "plan" ||
      this.currentState.currentMode === "auto"
    ) {
      // Absolute override: ignore all user configuration
      allPolicies = modePolicies;
    } else {
      // Normal mode: combine mode policies with user configuration
      const compiledPolicies = resolvePermissionPrecedence({
        commandLineFlags: runtimeOverrides,
        personalSettings: true, // Enable loading from ~/.continue/permissions.yaml
        useDefaults: true,
      });
      allPolicies = [...modePolicies, ...compiledPolicies];
    }

    this.setState({
      permissions: { policies: allPolicies },
      currentMode: this.currentState.currentMode,
      isHeadless: this.currentState.isHeadless,
      modePolicyCount: modePolicies.length,
    });

    // Mark as initialized since we're bypassing the async initialize flow
    (this as any).isInitialized = true;

    return this.getState();
  }

  /**
   * Initialize the tool permission service with runtime overrides (async version)
   */
  async doInitialize(runtimeOverrides?: {
    allow?: string[];
    ask?: string[];
    exclude?: string[];
    mode?: PermissionMode;
    isHeadless?: boolean;
  }): Promise<ToolPermissionServiceState> {
    // Ensure permissions.yaml exists before loading
    await ensurePermissionsYamlExists();

    // Use the synchronous version after ensuring the file exists
    return this.initializeSync(runtimeOverrides);
  }

  /**
   * Get the compiled permissions
   */
  getPermissions(): ToolPermissions {
    return this.getState().permissions;
  }

  /**
   * Update permissions (e.g., when config changes)
   */
  updatePermissions(newPolicies: ToolPermissionPolicy[]) {
    this.setState({
      permissions: { policies: newPolicies },
      modePolicyCount: 0, // Reset since we're replacing all policies
    });
    logger.debug(
      `Updated tool permissions with ${newPolicies.length} policies`,
    );
  }

  /**
   * Switch to a different permission mode
   */
  switchMode(newMode: PermissionMode): ToolPermissionServiceState {
    logger.debug(
      `Switching from mode '${this.currentState.currentMode}' to '${newMode}'`,
    );

    // Store original policies when leaving normal mode for the first time
    if (
      this.currentState.currentMode === "normal" &&
      newMode !== "normal" &&
      !this.currentState.originalPolicies
    ) {
      // Deep copy the policies array to preserve the original state
      this.setState({
        originalPolicies: {
          policies: [...this.currentState.permissions.policies],
        },
      });
      logger.debug(
        `Stored ${this.currentState.permissions.policies.length} original policies`,
      );
    }

    this.currentState.currentMode = newMode;

    // Regenerate policies with the new mode
    const modePolicies = this.generateModePolicies();

    // For plan and auto modes, use ONLY mode policies (absolute override)
    // For normal mode, restore original policies if available
    let allPolicies: ToolPermissionPolicy[];
    if (newMode === "plan" || newMode === "auto") {
      // Absolute override: ignore all user configuration
      allPolicies = modePolicies;
    } else {
      // Normal mode: restore original policies if we have them
      if (this.currentState.originalPolicies) {
        // Restore the original user policies
        // When original policies were stored in normal mode, they had 0 mode policies
        // So we need to slice from the number of mode policies that were active when stored
        const originalModePolicyCount = 0; // Normal mode has no mode policies
        const originalNonModePolicies =
          this.currentState.originalPolicies.policies.slice(
            originalModePolicyCount,
          );
        allPolicies = [...modePolicies, ...originalNonModePolicies];
        logger.debug(
          `Restored ${originalNonModePolicies.length} original user policies`,
        );
      } else {
        // Fallback to existing behavior if no original policies stored
        const existingPolicies = this.currentState.permissions.policies;
        const previousModePolicyCount = this.currentState.modePolicyCount || 0;
        const nonModePolicies =
          existingPolicies.length > previousModePolicyCount
            ? existingPolicies.slice(previousModePolicyCount)
            : [];
        allPolicies = [...modePolicies, ...nonModePolicies];
      }
    }

    this.setState({
      permissions: { policies: allPolicies },
      currentMode: newMode,
      modePolicyCount: modePolicies.length,
    });

    logger.debug(
      `Mode switched to '${newMode}' with ${allPolicies.length} total policies`,
    );
    return this.getState();
  }

  /**
   * Get the current permission mode
   */
  getCurrentMode(): PermissionMode {
    return this.currentState.currentMode;
  }

  /**
   * Get the headless state
   */
  isHeadless(): boolean {
    return this.currentState.isHeadless;
  }

  /**
   * Reload permissions from configuration files
   * Useful after policy changes to update the in-memory permissions
   */
  async reloadPermissions(): Promise<void> {
    // Only reload if we're in normal mode - other modes have absolute overrides
    if (this.currentState.currentMode !== "normal") {
      logger.debug("Skipping permission reload in non-normal mode");
      return;
    }

    logger.debug("Reloading permissions from configuration files");

    // Reload permissions from files
    const freshPolicies = resolvePermissionPrecedence({
      personalSettings: true, // Enable loading from ~/.continue/permissions.yaml
      useDefaults: true,
    });

    // Generate mode-specific policies (should be empty for normal mode)
    const modePolicies = this.generateModePolicies();

    // Combine mode policies with freshly loaded user policies
    const allPolicies = [...modePolicies, ...freshPolicies];

    this.setState({
      permissions: { policies: allPolicies },
      modePolicyCount: modePolicies.length,
    });

    logger.debug(
      `Reloaded permissions: ${freshPolicies.length} user policies, ${modePolicies.length} mode policies`,
    );

    // Update the service container with the new state
    // Import here to avoid circular dependencies
    try {
      const { serviceContainer } = await import("./ServiceContainer.js");
      const { SERVICE_NAMES } = await import("./types.js");
      serviceContainer.set(SERVICE_NAMES.TOOL_PERMISSIONS, this.getState());
      logger.debug("Updated service container with reloaded permissions");
    } catch (error) {
      logger.error(
        "Failed to update service container after permission reload",
        { error },
      );
    }
  }

  /**
   * Override isReady to always return true since we initialize synchronously
   */
  override isReady(): boolean {
    return true;
  }
}
