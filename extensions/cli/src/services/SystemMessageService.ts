import { PermissionMode } from "../permissions/types.js";
import { constructSystemMessage } from "../systemMessage.js";
import { logger } from "../util/logger.js";

import { BaseService } from "./BaseService.js";
import { MemoryService } from "./MemoryService.js";
import { SERVICE_NAMES } from "./types.js";

export interface SystemMessageServiceState {
  additionalRules?: string[];
  format?: "json";
  headless?: boolean;
  enableMemory?: boolean;
}

/**
 * Service for managing dynamic system message construction
 * Provides fresh system messages that reflect current mode and configuration
 */
export class SystemMessageService extends BaseService<SystemMessageServiceState> {
  private memoryService: MemoryService | null = null;

  constructor() {
    super("SystemMessageService", {});
  }

  /**
   * Initialize the service
   */
  async doInitialize(args: {
    additionalRules?: string[];
    format?: "json";
    headless?: boolean;
    enableMemory?: boolean;
    memoryService?: MemoryService;
  }): Promise<SystemMessageServiceState> {
    this.setState({
      additionalRules: args.additionalRules,
      format: args.format,
      headless: args.headless,
      enableMemory: args.enableMemory ?? true,
    });

    if (args.memoryService) {
      this.memoryService = args.memoryService;
    }

    logger.debug("SystemMessageService initialized", {
      hasAdditionalRules: !!args.additionalRules?.length,
      format: args.format,
      headless: args.headless,
      enableMemory: args.enableMemory ?? true,
    });

    return this.currentState;
  }

  /**
   * Attach a MemoryService instance for memory injection.
   * Called after both services are initialized.
   */
  attachMemoryService(memoryService: MemoryService): void {
    this.memoryService = memoryService;
    logger.debug("SystemMessageService: memory service attached");
  }

  /**
   * Get a fresh system message with current mode and configuration.
   * If memory is enabled and a MemoryService is attached, relevant memories
   * are selected and appended to the system message.
   */
  public async getSystemMessage(
    currentMode: PermissionMode,
    memoryQuery?: string,
  ): Promise<string> {
    const { additionalRules, format, headless, enableMemory } =
      this.currentState;

    const systemMessage = await constructSystemMessage(
      currentMode,
      additionalRules,
      format,
      headless,
    );

    logger.debug("Generated fresh system message", {
      mode: currentMode,
      messageLength: systemMessage.length,
    });

    // Append relevant memories if enabled
    if (enableMemory && this.memoryService) {
      try {
        const query = memoryQuery ?? currentMode;
        const memoryBlock =
          await this.memoryService.formatMemoriesForSystemMessage(query);
        if (memoryBlock) {
          return systemMessage + "\n\n" + memoryBlock;
        }
      } catch (err) {
        logger.warn("SystemMessageService: failed to load memories", { err });
      }
    }

    return systemMessage;
  }

  getDependencies(): string[] {
    return [SERVICE_NAMES.TOOL_PERMISSIONS];
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
}
