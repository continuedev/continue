import fsPromises from "fs/promises";
import * as path from "path";

import { env } from "../env.js";
import { logger } from "../util/logger.js";

import { BaseService } from "./BaseService.js";

/**
 * A feature flag definition with a default value and optional metadata.
 */
export interface FeatureFlagDefinition {
  /** Machine-readable key, also used as the env-var name prefix */
  key: string;
  /** Human-readable description */
  description: string;
  /** Default value when no override is present */
  defaultValue: boolean;
  /**
   * Whether this flag can be overridden via environment variables.
   * Env var name: `CONTINUE_FLAG_<KEY_UPPERCASE>` (e.g. `CONTINUE_FLAG_MEMORY_SYSTEM`)
   */
  allowEnvOverride?: boolean;
}

/**
 * Resolved flag values after applying defaults → remote config → env overrides.
 */
export type FlagValues = Record<string, boolean>;

export interface FeatureFlagsServiceState {
  flags: FlagValues;
  lastFetched: Date | null;
  remoteConfigUrl: string | null;
}

/**
 * Built-in feature flag definitions for all new features added from Marcel.
 * Add new flags here as more Marcel features are ported.
 */
export const BUILT_IN_FLAGS: FeatureFlagDefinition[] = [
  {
    key: "MEMORY_SYSTEM",
    description: "Enable the persistent memory system (MemoryService)",
    defaultValue: true,
    allowEnvOverride: true,
  },
  {
    key: "SEMANTIC_MEMORY_SELECTION",
    description:
      "Enable metadata-aware memory manifests and semantic memory selection.",
    defaultValue: false,
    allowEnvOverride: true,
  },
  {
    key: "TURN_LIFECYCLE_HOOKS",
    description:
      "Enable the shared turn lifecycle runner for post-response and turn-end behavior.",
    defaultValue: true,
    allowEnvOverride: true,
  },
  {
    key: "TASK_NOTIFICATIONS",
    description:
      "Enable structured task notifications for shell jobs, subagents, and coordinator flows.",
    defaultValue: true,
    allowEnvOverride: true,
  },
  {
    key: "COST_TRACKING",
    description: "Enable per-session cost tracking (CostTrackingService)",
    defaultValue: true,
    allowEnvOverride: true,
  },
  {
    key: "BUNDLED_SKILLS",
    description: "Enable bundled skill definitions registered by plugins",
    defaultValue: true,
    allowEnvOverride: true,
  },
  {
    key: "PLUGIN_REGISTRY",
    description: "Enable the plugin registry system (PluginRegistryService)",
    defaultValue: true,
    allowEnvOverride: true,
  },
  {
    key: "COORDINATOR_MODE",
    description:
      "Enable coordinator mode for multi-agent orchestration. " +
      "Set CONTINUE_FLAG_COORDINATOR_MODE=1 or pass --mode=coordinator.",
    defaultValue: false,
    allowEnvOverride: true,
  },
  {
    key: "CLI_STATUSLINE",
    description: "Enable the interactive CLI statusline footer.",
    defaultValue: true,
    allowEnvOverride: true,
  },
  {
    key: "CLI_VIM_MODE",
    description: "Enable vim-style input editing mode in the CLI.",
    defaultValue: false,
    allowEnvOverride: true,
  },
  {
    key: "VSCODE_BRIDGE_PERMISSIONS",
    description:
      "Enable typed VS Code bridge permission request and dialog contracts.",
    defaultValue: false,
    allowEnvOverride: true,
  },
  {
    key: "CACHED_MICROCOMPACTION",
    description:
      "Enable cached microcompaction and incremental context-pruning behavior.",
    defaultValue: false,
    allowEnvOverride: true,
  },
  {
    key: "VOICE_MODE",
    description: "Enable voice input/output (reserved for future use)",
    defaultValue: false,
    allowEnvOverride: true,
  },
  {
    key: "TEAM_MEMORY_SYNC",
    description: "Enable team-shared memory synchronisation (reserved)",
    defaultValue: false,
    allowEnvOverride: true,
  },
];

/** Path to the optional local flag override file */
const localFlagFile = () => path.join(env.continueHome, "feature-flags.json");

type RemoteFlagPayload = Record<string, boolean>;

async function loadLocalOverrides(): Promise<RemoteFlagPayload> {
  try {
    const raw = await fsPromises.readFile(localFlagFile(), "utf8");
    return JSON.parse(raw) as RemoteFlagPayload;
  } catch {
    return {};
  }
}

async function fetchRemoteFlags(url: string): Promise<RemoteFlagPayload> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return {};
    return (await res.json()) as RemoteFlagPayload;
  } catch (err) {
    logger.warn("FeatureFlagsService: remote fetch failed", { err });
    return {};
  }
}

/**
 * FeatureFlagsService resolves feature flag values from three sources,
 * applied in increasing precedence order:
 *
 * 1. Hard-coded defaults in `BUILT_IN_FLAGS`
 * 2. Remote JSON config (fetched from `CONTINUE_FLAGS_URL` if set)
 * 3. Local override file (`~/.continue/feature-flags.json`)
 * 4. Environment variables (`CONTINUE_FLAG_<KEY>=0|1`)
 *
 * Mirrors Marcel's GrowthBook + env-var feature gating system without
 * requiring an external SDK dependency.
 */
export class FeatureFlagsService extends BaseService<FeatureFlagsServiceState> {
  private definitions: FeatureFlagDefinition[] = [...BUILT_IN_FLAGS];

  constructor() {
    super("FeatureFlagsService", {
      flags: {},
      lastFetched: null,
      remoteConfigUrl: null,
    });
  }

  /**
   * Register an additional feature flag definition.
   * Must be called before `initialize()` to take effect.
   */
  registerFlag(definition: FeatureFlagDefinition): void {
    if (this.definitions.some((d) => d.key === definition.key)) {
      logger.debug(
        `FeatureFlagsService: flag "${definition.key}" already registered`,
      );
      return;
    }
    this.definitions.push(definition);
  }

  async doInitialize(args?: {
    remoteConfigUrl?: string;
  }): Promise<FeatureFlagsServiceState> {
    const remoteConfigUrl =
      args?.remoteConfigUrl ?? process.env.CONTINUE_FLAGS_URL ?? null;

    // 1. Defaults
    const flags: FlagValues = {};
    for (const def of this.definitions) {
      flags[def.key] = def.defaultValue;
    }

    // 2. Remote config
    if (remoteConfigUrl) {
      const remote = await fetchRemoteFlags(remoteConfigUrl);
      for (const [key, value] of Object.entries(remote)) {
        if (key in flags) {
          flags[key] = value;
        }
      }
    }

    // 3. Local override file
    const local = await loadLocalOverrides();
    for (const [key, value] of Object.entries(local)) {
      if (key in flags) {
        flags[key] = value;
      }
    }

    // 4. Environment variables
    for (const def of this.definitions) {
      if (!def.allowEnvOverride) continue;
      const envKey = `CONTINUE_FLAG_${def.key}`;
      const envVal = process.env[envKey];
      if (envVal === "1" || envVal === "true") {
        flags[def.key] = true;
      } else if (envVal === "0" || envVal === "false") {
        flags[def.key] = false;
      }
    }

    this.setState({ flags, lastFetched: new Date(), remoteConfigUrl });

    logger.debug("FeatureFlagsService initialized", {
      flags,
      remoteConfigUrl,
    });

    return this.currentState;
  }

  /**
   * Check if a feature flag is enabled.
   * Returns the default value if the key is not registered.
   */
  isEnabled(key: string): boolean {
    const val = this.currentState.flags[key];
    if (val === undefined) {
      const def = this.definitions.find((d) => d.key === key);
      return def?.defaultValue ?? false;
    }
    return val;
  }

  /**
   * Get all resolved flag values.
   */
  getAllFlags(): FlagValues {
    return { ...this.currentState.flags };
  }

  /**
   * Override a flag value at runtime (not persisted).
   */
  setFlag(key: string, value: boolean): void {
    this.setState({
      flags: { ...this.currentState.flags, [key]: value },
    });
    logger.debug(`FeatureFlagsService: set "${key}" = ${value}`);
  }

  /**
   * Write the current flag overrides to the local file.
   * Only writes flags that differ from their default values.
   */
  async persistOverrides(): Promise<void> {
    const overrides: FlagValues = {};
    for (const def of this.definitions) {
      const current = this.currentState.flags[def.key];
      if (current !== def.defaultValue) {
        overrides[def.key] = current!;
      }
    }

    try {
      await fsPromises.mkdir(env.continueHome, { recursive: true });
      await fsPromises.writeFile(
        localFlagFile(),
        JSON.stringify(overrides, null, 2),
        "utf8",
      );
      logger.debug("FeatureFlagsService: persisted overrides", { overrides });
    } catch (err) {
      logger.warn("FeatureFlagsService: could not persist overrides", { err });
    }
  }
}

/** Singleton exported for convenient direct use */
export const featureFlagsService = new FeatureFlagsService();
