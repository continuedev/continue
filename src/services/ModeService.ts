import { EventEmitter } from "events";
import { PermissionMode } from "../permissions/types.js";
import logger from "../util/logger.js";
import { ToolPermissionService } from "./ToolPermissionService.js";

/**
 * Global service for managing permission modes
 * Provides a singleton interface for mode switching
 */
export class ModeService extends EventEmitter {
  private static instance: ModeService;
  private toolPermissionService: ToolPermissionService;

  private constructor() {
    super();
    this.toolPermissionService = new ToolPermissionService();
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
  public initialize(args: {
    readonly?: boolean;
    allow?: string[];
    ask?: string[];
    exclude?: string[];
  }) {
    // Convert legacy flags to mode
    let mode: PermissionMode = "normal";
    if (args.readonly) {
      mode = "plan";  // Legacy flag maps directly to plan mode
    }

    this.toolPermissionService.initializeSync({
      allow: args.allow,
      ask: args.ask,
      exclude: args.exclude,
      mode
    });

    logger.debug(`ModeService initialized with mode: ${mode}`);
  }

  /**
   * Switch to a different mode
   */
  public switchMode(mode: PermissionMode): void {
    const previousMode = this.toolPermissionService.getCurrentMode();
    const newState = this.toolPermissionService.switchMode(mode);
    logger.info(`Switched to ${mode} mode`);
    
    // Emit mode change event for immediate UI updates
    if (previousMode !== mode) {
      this.emit('modeChanged', mode, previousMode);
    }
  }

  /**
   * Get the current mode
   */
  public getCurrentMode(): PermissionMode {
    return this.toolPermissionService.getCurrentMode();
  }

  /**
   * Get the tool permission service instance
   */
  public getToolPermissionService(): ToolPermissionService {
    return this.toolPermissionService;
  }

  /**
   * Get available modes with descriptions
   */
  public getAvailableModes(): Array<{ mode: PermissionMode; description: string }> {
    return [
      { mode: "normal", description: "Default mode - follows configured permission policies" },
      { mode: "plan", description: "Planning mode - only allow read-only tools for analysis" },
      { mode: "auto", description: "Automatically allow all tools without asking" }
    ];
  }
}

// Export singleton instance
export const modeService = ModeService.getInstance();