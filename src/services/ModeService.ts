import { PermissionMode } from "../permissions/types.js";
import { logger } from "../util/logger.js";

import { BaseService } from "./BaseService.js";
import { ToolPermissionService } from "./ToolPermissionService.js";

export interface ModeServiceState {
  mode: PermissionMode;
  toolPermissionService: ToolPermissionService;
}

/**
 * Global service for managing permission modes
 * Provides a singleton interface for mode switching
 */
export class ModeService extends BaseService<ModeServiceState> {
  private static instance: ModeService;

  private constructor() {
    const toolPermissionService = new ToolPermissionService();
    super("ModeService", {
      mode: "normal",
      toolPermissionService,
    });

    // Increase max listeners since ModeService is a singleton that can have
    // multiple subscribers (UI components, tests, etc.)
    this.setMaxListeners(100);
  }

  public static getInstance(): ModeService {
    if (!ModeService.instance) {
      ModeService.instance = new ModeService();
    }
    return ModeService.instance;
  }

  /**
   * Initialize the mode service with command line arguments
   */
  async doInitialize(args: {
    readonly?: boolean;
    auto?: boolean;
    allow?: string[];
    ask?: string[];
    exclude?: string[];
    isHeadless?: boolean;
  }): Promise<ModeServiceState> {
    // Convert legacy flags to mode
    let mode: PermissionMode = "normal";
    if (args.readonly) {
      mode = "plan"; // Legacy flag maps directly to plan mode
    } else if (args.auto) {
      mode = "auto"; // Auto flag maps to auto mode
    }

    this.currentState.toolPermissionService.initializeSync({
      allow: args.allow,
      ask: args.ask,
      exclude: args.exclude,
      mode,
      isHeadless: args.isHeadless,
    });

    logger.debug(`ModeService initialized with mode: ${mode}`);

    return {
      mode,
      toolPermissionService: this.currentState.toolPermissionService,
    };
  }

  /**
   * Switch to a different mode
   */
  public switchMode(mode: PermissionMode): void {
    const previousMode = this.currentState.mode;
    this.currentState.toolPermissionService.switchMode(mode);

    this.setState({ mode });

    logger.info(`Switched to ${mode} mode`);

    // Emit mode change event for immediate UI updates
    if (previousMode !== mode) {
      this.emit("modeChanged", mode, previousMode);
    }
  }

  /**
   * Get the current mode
   */
  public getCurrentMode(): PermissionMode {
    return this.currentState.mode;
  }

  /**
   * Get the tool permission service instance
   */
  public getToolPermissionService(): ToolPermissionService {
    return this.currentState.toolPermissionService;
  }

  /**
   * Get available modes with descriptions
   */
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

  /**
   * Override cleanup to properly clean up nested ToolPermissionService
   */
  override async cleanup(): Promise<void> {
    await this.currentState.toolPermissionService.cleanup();
    await super.cleanup();
  }

  /**
   * Override isReady since this is a singleton with immediate availability
   */
  override isReady(): boolean {
    return true;
  }
}

// Export singleton instance
export const modeService = ModeService.getInstance();
