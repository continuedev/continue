import { instructionFilesFingerprint } from "../instructionFiles.js";
import { PermissionMode } from "../permissions/types.js";
import { constructSystemMessage } from "../systemMessage.js";
import { logger } from "../util/logger.js";

import { BaseService } from "./BaseService.js";
import { serviceContainer } from "./ServiceContainer.js";
import { type ModelServiceState, SERVICE_NAMES } from "./types.js";

export interface SystemMessageServiceState {
  additionalRules?: string[];
  format?: "json";
  headless?: boolean;
}

interface CachedSystemMessage {
  message: string;
  /** The instruction files' paths, mtimes and sizes when it was built. */
  fingerprint: string;
}

/**
 * Service for the system message.
 *
 * The message is built once per mode and configuration and reused for every
 * request, so the cached prefix of the prompt stays the same from turn to
 * turn: constructSystemMessage reads AGENTS.md and the rule files, and a
 * rebuild on every request rewrote the prefix whenever the model edited one
 * of them. It is rebuilt when the mode changes (the plan and act texts differ
 * by design, and each mode keeps its own copy), when the configuration is
 * reloaded, switched or updated, on `invalidate()`, and when an instruction
 * file is added, removed or changes its mtime or size (a few stat calls per
 * request, no file read).
 */
export class SystemMessageService extends BaseService<SystemMessageServiceState> {
  private cache = new Map<string, CachedSystemMessage>();
  private readonly onConfigChanged = () => this.invalidate("config changed");

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
    this.cache.clear();

    // The config's rules are part of the message, so a reloaded or switched
    // config (serviceContainer sets the config service's value) rebuilds it.
    const event = `${SERVICE_NAMES.CONFIG}:changed`;
    serviceContainer.off(event, this.onConfigChanged);
    serviceContainer.on(event, this.onConfigChanged);

    logger.debug("SystemMessageService initialized", {
      hasAdditionalRules: !!args.additionalRules?.length,
      format: args.format,
      headless: args.headless,
    });

    return this.currentState;
  }

  /**
   * The id of the model in use, for the turn text's prompt profile (short for
   * Qwen). Read without waiting: before the model service is ready the full
   * text is built, and the key changes once a model is known.
   */
  private currentModelId(): string | undefined {
    const model = serviceContainer.getSync<ModelServiceState>(
      SERVICE_NAMES.MODEL,
    ).value?.model;
    return model?.model;
  }

  private cacheKey(mode: PermissionMode, modelId: string | undefined): string {
    const { additionalRules, format, headless } = this.currentState;
    return JSON.stringify([
      mode,
      additionalRules ?? [],
      format ?? null,
      headless ?? false,
      modelId ?? null,
    ]);
  }

  /**
   * The system message for this mode: the cached one when nothing it depends
   * on has changed, otherwise built now and cached.
   */
  public async getSystemMessage(currentMode: PermissionMode): Promise<string> {
    const modelId = this.currentModelId();
    const key = this.cacheKey(currentMode, modelId);
    const fingerprint = instructionFilesFingerprint();
    const cached = this.cache.get(key);
    if (cached && cached.fingerprint === fingerprint) {
      return cached.message;
    }

    const { additionalRules, format, headless } = this.currentState;
    const systemMessage = await constructSystemMessage(
      currentMode,
      additionalRules,
      format,
      headless,
      modelId,
    );
    this.cache.set(key, { message: systemMessage, fingerprint });

    logger.debug("Built system message", {
      mode: currentMode,
      messageLength: systemMessage.length,
      reason: cached ? "instruction files changed" : "not cached for this mode",
    });

    return systemMessage;
  }

  /** Drop the cached messages, so the next request builds the message again. */
  public invalidate(reason = "requested"): void {
    if (this.cache.size === 0) return;
    this.cache.clear();
    logger.debug("System message cache cleared", { reason });
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
    this.invalidate("service config updated");

    logger.debug("SystemMessageService config updated", config);
  }

  async cleanup(): Promise<void> {
    serviceContainer.off(
      `${SERVICE_NAMES.CONFIG}:changed`,
      this.onConfigChanged,
    );
    this.cache.clear();
    await super.cleanup();
  }
}
