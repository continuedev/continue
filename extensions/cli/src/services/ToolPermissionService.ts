import {
  AUTO_MODE_POLICIES,
  PLAN_MODE_POLICIES,
} from "src/permissions/defaultPolicies.js";
import { ALL_BUILT_IN_TOOLS } from "src/tools/allBuiltIns.js";

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
  generateAgentFilePolicies(
    agentFileServiceState?: AgentFileServiceState,
    mcpServiceState?: MCPServiceState,
  ): ToolPermissionPolicy[] {
    // With --agent, all available tools are allowed if not specified
    const parsedTools = agentFileServiceState?.parsedTools;
    if (!parsedTools) {
      return [
        {
          tool: "*",
          permission: "allow",
        },
      ];
    }

    const policies: ToolPermissionPolicy[] = [];
    const servers = Array.from(mcpServiceState?.connections?.values() ?? []);
    for (const mcpServer of parsedTools.mcpServers) {
      const server = servers?.find(
        (s) => s.config?.sourceSlug && s.config.sourceSlug === mcpServer,
      );
      if (!server) {
        logger.warn("No connected MCP server found ");
        continue;
      }

      const specificTools = parsedTools.tools.filter(
        (t) => t.mcpServer && t.toolName && t.mcpServer === mcpServer,
      );

      // In the `tools` key of an agent is comma separated strings like
      // mcp/server, mcp/server2:tool_name, Bash
      // - this would give the agent access to ALL tools from mcp/server, ONLY tool_name from mcp/server2, and Bash, and no other tools
      // mcp/server
      // - this would give the agent access to ALL tools from mcp/server, and no built-ins
      // built_in, mcp/server
      // - "built_in" keyword can be used to include all built ins
      // Blank = all built-in tools

      // Handle MCP first
      // If ANY mcp tools are specifically called out, only allow those ones for that mcp server
      // Otherwise the blanket allow will cover all MCP tools
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

    // If mcp servers or specific built-in tools are specified
    // then we only inclue listed built-in tools and exclude all others
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
        return [...PLAN_MODE_POLICIES];
      case "auto":
        return [...AUTO_MODE_POLICIES];
      case "normal":
      default:
        // Normal mode uses the more nuanced policy loading
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

    const modePolicies = this.generateModePolicies();

    let allPolicies: ToolPermissionPolicy[];
    if (agentFileServiceState?.agentFile) {
      // Agent file policies take full precedence on init
      allPolicies = this.generateAgentFilePolicies(
        agentFileServiceState,
        mcpServiceState,
      );
    } else if (
      this.currentState.currentMode === "plan" ||
      this.currentState.currentMode === "auto"
    ) {
      // For plan and auto modes, use ONLY mode policies (absolute override)
      allPolicies = [...modePolicies];
    } else {
      // Normal mode: combine headless + mode policies with user configuration
      const compiledPolicies = resolvePermissionPrecedence({
        commandLineFlags: runtimeOverrides,
        personalSettings: true, // Enable loading from ~/.continue/permissions.yaml
        useDefaults: true,
        isHeadless: this.currentState.isHeadless,
      });
      allPolicies = [...compiledPolicies];
    }

    this.setState({
      permissions: { policies: allPolicies },
      currentMode: this.currentState.currentMode,
      isHeadless: this.currentState.isHeadless,
      modePolicyCount: modePolicies.length,
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

    const modePolicies = this.generateModePolicies();

    // For plan and auto modes, use ONLY mode policies (absolute override)
    // For normal mode, restore original policies if available
    let allPolicies: ToolPermissionPolicy[];
    if (newMode === "plan" || newMode === "auto") {
      // Absolute override: ignore all user configuration
      allPolicies = [...modePolicies];
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
        allPolicies = [...originalNonModePolicies];
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
        allPolicies = [...nonModePolicies];
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

    // Combine mode policies with freshly loaded user policies
    const allPolicies = [...freshPolicies];

    this.setState({
      permissions: { policies: allPolicies },
      modePolicyCount: 0,
    });

    logger.debug(`Reloaded permissions: ${freshPolicies.length} user policies`);
  }

  /**
   * Override isReady to always return true since we initialize synchronously
   */
  override isReady(): boolean {
    return true;
  }
}
