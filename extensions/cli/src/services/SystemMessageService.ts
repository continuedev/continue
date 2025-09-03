import { PermissionMode } from "../permissions/types.js";
import { constructSystemMessage } from "../systemMessage.js";
import { logger } from "../util/logger.js";

import { BaseService } from "./BaseService.js";
import { modeService } from "./ModeService.js";

export interface SystemMessageServiceState {
  additionalRules?: string[];
  format?: "json";
  headless?: boolean;
}

/**
 * Service for managing dynamic system message construction
 * Provides fresh system messages that reflect current mode and configuration
 */
export class SystemMessageService extends BaseService<SystemMessageServiceState> {
  private currentMode: PermissionMode = "normal";

  constructor() {
    super("SystemMessageService", {});

    // Listen to mode changes from ModeService
    this.setupModeListener();
  }

  /**
   * Set up listener for mode changes
   */
  private setupModeListener(): void {
    modeService.on("modeChanged", (newMode: PermissionMode) => {
      logger.debug(`SystemMessageService: Mode changed to ${newMode}`);
      this.currentMode = newMode;
    });

    // Initialize current mode
    this.currentMode = modeService.getCurrentMode();
  }

  /**
   * Initialize the service
   */
  async doInitialize(args: {
    additionalRules?: string[];
    format?: "json";
    headless?: boolean;
  }): Promise<SystemMessageServiceState> {
    this.setState({
      additionalRules: args.additionalRules,
      format: args.format,
      headless: args.headless,
    });

    logger.debug("SystemMessageService initialized", {
      hasAdditionalRules: !!args.additionalRules?.length,
      format: args.format,
      headless: args.headless,
    });

    return this.currentState;
  }

  /**
   * Get a fresh system message with current mode and configuration
   */
  public async getSystemMessage(): Promise<string> {
    const { additionalRules, format, headless } = this.currentState;

    const systemMessage = await constructSystemMessage(
      additionalRules,
      format,
      headless,
      this.currentMode,
    );

    logger.debug("Generated fresh system message", {
      mode: this.currentMode,
      messageLength: systemMessage.length,
    });

    return systemMessage;
  }

  /**
   * Update configuration that affects system message
   */
  public updateConfig(config: Partial<SystemMessageServiceState>): void {
    this.setState({
      ...this.currentState,
      ...config,
    });

    logger.debug("SystemMessageService config updated", config);
  }

  /**
   * Get the current mode being used for system messages
   */
  public getCurrentMode(): PermissionMode {
    return this.currentMode;
  }
}

// Export singleton instance
export const systemMessageService = new SystemMessageService();
