import { PermissionMode } from "../permissions/types.js";
import { constructSystemMessage } from "../systemMessage.js";
import { logger } from "../util/logger.js";

import { BaseService } from "./BaseService.js";
import { SERVICE_NAMES } from "./types.js";

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
  // Cache of constructed system messages keyed by the inputs that affect them.
  // The system message is re-fetched on every streaming iteration and its
  // construction re-reads AGENTS.md/CLAUDE.md files and re-runs `git status`,
  // so any change made by the agent invalidates the whole prompt prefix and
  // cold-starts the provider's prompt cache. Memoizing per (mode, rules,
  // format, headless) keeps the prefix byte-identical across turns — the same
  // invariant Reasonix enforces by building its system prompt once at boot.
  private systemMessageCache = new Map<string, string>();

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
  public async getSystemMessage(currentMode: PermissionMode): Promise<string> {
    const { additionalRules, format, headless } = this.currentState;

    const cacheKey = JSON.stringify([
      currentMode,
      additionalRules,
      format,
      headless,
    ]);
    const cached = this.systemMessageCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const systemMessage = await constructSystemMessage(
      currentMode,
      additionalRules,
      format,
      headless,
    );

    this.systemMessageCache.set(cacheKey, systemMessage);

    logger.debug("Generated fresh system message", {
      mode: currentMode,
      messageLength: systemMessage.length,
    });

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
