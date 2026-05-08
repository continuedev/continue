/**
 * HookService — service container integration for the hooks system.
 *
 * Loads hook configuration from settings files and provides a `fireEvent`
 * method that integration points call to trigger hooks.
 */

import type {
  TurnLifecycleContext,
  TurnLifecycleHandler,
  TurnLifecycleResult,
} from "core/agent/contracts/index.js";

import { BaseService } from "../services/BaseService.js";
import { logger } from "../util/logger.js";

import { loadHooksConfig } from "./hookConfig.js";
import { runHooks } from "./hookRunner.js";
import type { HookEventResult, HookInput, HooksConfig } from "./types.js";

// ---------------------------------------------------------------------------
// Service state
// ---------------------------------------------------------------------------

export interface HookServiceState {
  /** The merged hooks config from all settings files */
  config: HooksConfig;
  /** Whether all hooks are disabled (disableAllHooks: true) */
  disabled: boolean;
  /** Hooks that have already run their "once" execution */
  onceKeys: Set<string>;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class HookService extends BaseService<HookServiceState> {
  private cwd: string;

  constructor() {
    super("hooks", {
      config: {},
      disabled: false,
      onceKeys: new Set(),
    });
    this.cwd = process.cwd();
  }

  async doInitialize(cwd?: string): Promise<HookServiceState> {
    if (cwd) {
      this.cwd = cwd;
    }

    const loaded = loadHooksConfig(this.cwd);

    const eventCount = Object.keys(loaded.hooks).length;
    const handlerCount = Object.values(loaded.hooks).reduce(
      (sum, groups) =>
        sum + (groups?.reduce((s, g) => s + g.hooks.length, 0) ?? 0),
      0,
    );

    if (handlerCount > 0) {
      logger.debug(
        `Hooks loaded: ${handlerCount} handler(s) across ${eventCount} event type(s)`,
      );
    }

    return {
      config: loaded.hooks,
      disabled: loaded.disabled,
      onceKeys: new Set(),
    };
  }

  /**
   * Fire a hook event and return the aggregated result.
   *
   * This is the main entry point used by all integration points.
   * Returns a no-op result if hooks are disabled.
   */
  async fireEvent(input: HookInput): Promise<HookEventResult> {
    if (this.currentState.disabled) {
      return { blocked: false, results: [] };
    }

    if (Object.keys(this.currentState.config).length === 0) {
      return { blocked: false, results: [] };
    }

    try {
      const result = await runHooks(this.currentState.config, input, this.cwd);
      return result;
    } catch (error) {
      logger.warn(`Hook event ${input.hook_event_name} failed:`, error);
      // Hook errors should not break the main flow
      return { blocked: false, results: [] };
    }
  }

  async runTurnLifecycle<Message>(
    context: TurnLifecycleContext<Message>,
    handlers: readonly TurnLifecycleHandler<Message>[],
  ): Promise<TurnLifecycleResult> {
    const aggregate: TurnLifecycleResult = {};

    for (const handler of handlers) {
      try {
        const result = await handler(context);
        if (!result) {
          continue;
        }

        if (result.messages?.length) {
          aggregate.messages = [
            ...(aggregate.messages ?? []),
            ...result.messages,
          ];
        }

        if (result.metadata) {
          aggregate.metadata = {
            ...(aggregate.metadata ?? {}),
            ...result.metadata,
          };
        }

        if (result.blocked) {
          aggregate.blocked = true;
          break;
        }
      } catch (error) {
        logger.warn(
          `Turn lifecycle handler failed in ${context.phase}:`,
          error,
        );
      }
    }

    return aggregate;
  }

  /**
   * Reload hooks config from disk (e.g., after config file changes).
   */
  async reloadConfig(): Promise<void> {
    const loaded = loadHooksConfig(this.cwd);
    this.setState({
      config: loaded.hooks,
      disabled: loaded.disabled,
    });
  }

  /**
   * Get the session-level common fields that go into every hook input.
   * Integration points should call this and spread it into their event-specific input.
   */
  getCommonFields(
    sessionId: string,
    transcriptPath: string,
    permissionMode?: string,
  ): {
    session_id: string;
    transcript_path: string;
    cwd: string;
    permission_mode?: string;
  } {
    return {
      session_id: sessionId,
      transcript_path: transcriptPath,
      cwd: this.cwd,
      permission_mode: permissionMode,
    };
  }
}
