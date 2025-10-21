import { ALL_BUILT_IN_TOOLS } from "src/tools/index.js";
import { ensurePermissionsYamlExists } from "../permissions/permissionsYamlLoader.js";
import { resolvePermissionPrecedence } from "../permissions/precedenceResolver.js";
import {
  PermissionMode,
  ToolPermissionPolicy,
  ToolPermissions,
} from "../permissions/types.js";
import { logger } from "../util/logger.js";

import { BaseService, ServiceWithDependencies } from "./BaseService.js";
import { serviceContainer } from "./ServiceContainer.js";
import {
  AgentFileServiceState,
  MCPServiceState,
  SERVICE_NAMES,
} from "./types.js";

export interface InitializeToolServiceOverrides {
  allow?: string[];
  ask?: string[];
  exclude?: string[];
  mode?: PermissionMode;
  isHeadless?: boolean;
}

export interface ToolPermissionServiceState {
  permissions: ToolPermissions;
  currentMode: PermissionMode;
  isHeadless: boolean;
  modePolicyCount?: number; // Track how many policies are from mode vs other sources
  agentFilePolicyCount?: number;
  originalPolicies?: ToolPermissions; // Store original policies when switching modes
}

/**
 * Service for managing tool permissions with a single source of truth
 */
export class ToolPermissionService
  extends BaseService<ToolPermissionServiceState>
  implements ServiceWithDependencies
{
  constructor() {
    super("ToolPermissionService", {
      permissions: { policies: [] },
      currentMode: "normal",
      isHeadless: false,
      modePolicyCount: 0,
    });
  }

  /**
   * Override setState to notify the ServiceContainer
   * This ensures reactive UI components get updated when mode changes
   */
  protected override setState(
    newState: Partial<ToolPermissionServiceState>,
  ): void {
    super.setState(newState);
    serviceContainer.set(SERVICE_NAMES.TOOL_PERMISSIONS, this.currentState);
  }

  /**
   * Declare dependencies on other services
   */
  getDependencies(): string[] {
    return [SERVICE_NAMES.AGENT_FILE, SERVICE_NAMES.MCP];
  }

  /**
   * Generate agent-file-specific policies if an agent file is active
   */
  private generateAgentFilePolicies(
    agentFileServiceState?: AgentFileServiceState,
    mcpServiceState?: MCPServiceState,
  ): undefined | ToolPermissionPolicy[] {
    const parsedTools = agentFileServiceState?.parsedTools;
    if (!parsedTools?.tools.length) {
      return undefined;
    }

    const policies: ToolPermissionPolicy[] = [];
    const servers = Array.from(mcpServiceState?.connections?.values() ?? []);
    for (const mcpServer of parsedTools.mcpServers) {
      const server = servers?.find(
        (s) => s.config?.sourceSlug && s.config.sourceSlug === mcpServer,
      );
      if (!server) {
        console.warn("No connected MCP server found ");
        continue;
      }

      const specificTools = parsedTools.tools.filter(
        (t) => t.mcpServer && t.toolName && t.mcpServer === mcpServer,
      );
      // If ANY mcp tools are specifically called out, only allow those ones for that mcp server
      if (specificTools.length) {
        const specificSet = new Set(specificTools.map((t) => t.toolName));
        const notMentioned = server.tools.filter(
          (t) => !specificSet.has(t.name),
        );
        const allowed: ToolPermissionPolicy[] = specificTools.map((t) => ({
          tool: t.toolName!,
          permission: "allow",
        }));
        policies.push(...allowed);
        const disallowed: ToolPermissionPolicy[] = notMentioned.map((t) => ({
          tool: t.name,
          permission: "exclude",
        }));
        policies.push(...disallowed);
      }
    }

    const hasMcp = !!parsedTools.mcpServers?.length;
    const specificBuiltIns = parsedTools.tools
      .filter((t) => !t.mcpServer)
      .map((t) => t.toolName!);
    if (specificBuiltIns.length || (hasMcp && !parsedTools.allBuiltIn)) {
      const allowed: ToolPermissionPolicy[] = specificBuiltIns.map((tool) => ({
        tool,
        permission: "allow",
      }));
      policies.push(...allowed);
      const specificBuiltInSet = new Set(specificBuiltIns);
      const notMentioned = ALL_BUILT_IN_TOOLS.map((t) => t.name).filter(
        (name) => !specificBuiltInSet.has(name),
      );
      const disallowed: ToolPermissionPolicy[] = notMentioned.map((tool) => ({
        tool,
        permission: "exclude",
      }));
      policies.push(...disallowed);
    }

    // Allow all other tools
    policies.push({
      tool: "*",
      permission: "allow",
    });

    return policies;
  }

  /**
   * Generate mode-specific policies based on the current mode
   */
  private generateModePolicies(): ToolPermissionPolicy[] {
    switch (this.currentState.currentMode) {
      case "plan":
        // Plan mode: Complete override - exclude all write operations, allow only reads and bash
        // TODO - RECONSIDER bash and MCP, maybe fall back to user settings for those
        return [
          // Exclude all write tools with absolute priority
          { tool: "Write", permission: "exclude" },
          { tool: "Edit", permission: "exclude" },
          { tool: "MultiEdit", permission: "exclude" },
          { tool: "NotebookEdit", permission: "exclude" },
          { tool: "*", permission: "allow" },
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
  initializeSync(
    runtimeOverrides?: InitializeToolServiceOverrides,
    agentFileServiceState?: AgentFileServiceState,
    mcpServiceState?: MCPServiceState,
  ): ToolPermissionServiceState {
    logger.debug("Synchronously initializing ToolPermissionService");

    // Set mode from overrides or default
    if (runtimeOverrides?.mode) {
      this.setState({ currentMode: runtimeOverrides.mode });
    }

    // Set headless flag from overrides
    if (runtimeOverrides?.isHeadless !== undefined) {
      this.setState({ isHeadless: runtimeOverrides.isHeadless });
    }

    const agentFilePolicies = this.generateAgentFilePolicies(
      agentFileServiceState,
      mcpServiceState,
    );
    const modePolicies = this.generateModePolicies();

    // For plan and auto modes, use ONLY mode policies (absolute override)
    // For normal mode, combine with user configuration
    let allPolicies: ToolPermissionPolicy[];
    if (agentFilePolicies) {
      // Agent file policies take full precedence on init
      allPolicies = agentFilePolicies;
    } else if (
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
      agentFilePolicyCount: (agentFilePolicies ?? []).length,
    });

    (this as any).isInitialized = true;

    return this.getState();
  }

  /**
   * Initialize the tool permission service with runtime overrides (async version)
   */
  async doInitialize(
    runtimeOverrides?: InitializeToolServiceOverrides,
    agentFileServiceState?: AgentFileServiceState,
    mcpServiceState?: MCPServiceState,
  ): Promise<ToolPermissionServiceState> {
    await ensurePermissionsYamlExists();

    // Use the synchronous version after ensuring the file exists
    return this.initializeSync(
      runtimeOverrides,
      agentFileServiceState,
      mcpServiceState,
    );
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
    const currentMode = this.currentState.currentMode;
    logger.debug(`Switching from mode '${currentMode}' to '${newMode}'`);

    // Store original policies when leaving normal mode for the first time
    if (
      currentMode === "normal" &&
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

    this.setState({
      currentMode: newMode,
    });
    this.emit("modeChanged", newMode, currentMode);

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
  }

  /**
   * Override isReady to always return true since we initialize synchronously
   */
  override isReady(): boolean {
    return true;
  }

  public getAvailableModes(): Array<{
    mode: PermissionMode;
    description: string;
  }> {
    return [
      {
        mode: "normal",
        description: "Default mode - follows configured permission policies",
      },
      {
        mode: "plan",
        description: "Planning mode - only allow read-only tools for analysis",
      },
      {
        mode: "auto",
        description: "Automatically allow all tools without asking",
      },
    ];
  }
}
