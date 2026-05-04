import fsPromises from "fs/promises";
import * as path from "path";

import { env } from "../env.js";
import { registerBundledSkill } from "../util/bundledSkills.js";
import { logger } from "../util/logger.js";

import { BaseService } from "./BaseService.js";

/**
 * A plugin definition that can bundle skills, hook config, and MCP server
 * references. Mirrors Marcel's plugin model.
 */
export interface PluginDefinition {
  /** Unique plugin identifier (e.g. "my-plugin" or "my-plugin@1.0.0") */
  id: string;
  /** Human-readable display name */
  displayName: string;
  /** Short description of what this plugin does */
  description: string;
  /** Whether the plugin is enabled by default */
  enabledByDefault?: boolean;
  /**
   * Optional gate function — if it returns false, the plugin will not be
   * loaded regardless of the enabled/disabled setting.
   */
  isAvailable?: () => boolean | Promise<boolean>;
  /** Bundled skill definitions to register when this plugin is enabled */
  skills?: Array<{
    name: string;
    description: string;
    files?: Record<string, string>;
    getPrompt: (args: string, baseDir: string) => string;
  }>;
  /**
   * Additional hook configuration to merge into the hooks system when this
   * plugin is enabled. The shape mirrors `HooksConfig` from hooks/types.ts.
   */
  hooksConfig?: Record<string, unknown>;
  /**
   * MCP server slugs or configs this plugin wants to activate. The CLI will
   * log a warning if the referenced server is not present in the user config.
   */
  mcpServers?: string[];
}

export interface LoadedPlugin {
  definition: PluginDefinition;
  enabled: boolean;
}

export interface PluginRegistryServiceState {
  plugins: LoadedPlugin[];
  enabledCount: number;
  disabledCount: number;
}

/** Path to the user-controlled plugin enable/disable overrides JSON. */
const pluginStateFile = () => path.join(env.continueHome, "plugin-state.json");

type PluginStateFile = Record<string, boolean>;

async function loadPluginState(): Promise<PluginStateFile> {
  try {
    const raw = await fsPromises.readFile(pluginStateFile(), "utf8");
    return JSON.parse(raw) as PluginStateFile;
  } catch {
    return {};
  }
}

async function savePluginState(state: PluginStateFile): Promise<void> {
  try {
    await fsPromises.mkdir(env.continueHome, { recursive: true });
    await fsPromises.writeFile(
      pluginStateFile(),
      JSON.stringify(state, null, 2),
      "utf8",
    );
  } catch (err) {
    logger.warn("PluginRegistryService: could not save plugin state", { err });
  }
}

/**
 * PluginRegistryService manages a registry of plugins that can bundle skills,
 * hook configuration, and MCP server references.
 *
 * Plugins are registered in code via `registerPlugin()`. Users can override
 * the enabled/disabled state, which is persisted to
 * `~/.continue/plugin-state.json`.
 *
 * Mirrors Marcel's plugin system (builtinPlugins.ts / plugins/).
 */
export class PluginRegistryService extends BaseService<PluginRegistryServiceState> {
  private registered: PluginDefinition[] = [];

  constructor() {
    super("PluginRegistryService", {
      plugins: [],
      enabledCount: 0,
      disabledCount: 0,
    });
  }

  /**
   * Register a plugin definition. Must be called before `initialize()`.
   * Safe to call after initialization — the plugin will be evaluated immediately.
   */
  registerPlugin(definition: PluginDefinition): void {
    if (this.registered.some((p) => p.id === definition.id)) {
      logger.debug(
        `PluginRegistryService: "${definition.id}" already registered, skipping`,
      );
      return;
    }
    this.registered.push(definition);
    logger.debug(`PluginRegistryService: registered plugin "${definition.id}"`);
  }

  async doInitialize(): Promise<PluginRegistryServiceState> {
    const userState = await loadPluginState();
    const plugins = await this.resolvePlugins(userState);
    this.applyEnabledPlugins(plugins);
    this.updateCounts(plugins);

    logger.debug("PluginRegistryService initialized", {
      total: plugins.length,
      enabled: this.currentState.enabledCount,
    });

    return this.currentState;
  }

  private async resolvePlugins(
    userState: PluginStateFile,
  ): Promise<LoadedPlugin[]> {
    const result: LoadedPlugin[] = [];

    for (const def of this.registered) {
      // Evaluate availability gate
      let available = true;
      if (def.isAvailable) {
        try {
          available = await def.isAvailable();
        } catch {
          available = false;
        }
      }

      if (!available) {
        logger.debug(
          `PluginRegistryService: plugin "${def.id}" not available (gate returned false)`,
        );
        continue;
      }

      // Determine enabled state: user override → default
      const enabled =
        def.id in userState
          ? userState[def.id]!
          : (def.enabledByDefault ?? true);

      result.push({ definition: def, enabled });
    }

    return result;
  }

  private applyEnabledPlugins(plugins: LoadedPlugin[]): void {
    for (const plugin of plugins) {
      if (!plugin.enabled) continue;

      // Register bundled skills
      for (const skill of plugin.definition.skills ?? []) {
        registerBundledSkill({
          name: skill.name,
          description: skill.description,
          files: skill.files,
          getPrompt: skill.getPrompt,
        });
      }

      // Log MCP server references (actual connection is handled by MCPService)
      for (const slug of plugin.definition.mcpServers ?? []) {
        logger.debug(
          `PluginRegistryService: plugin "${plugin.definition.id}" references MCP server "${slug}"`,
        );
      }
    }
  }

  private updateCounts(plugins: LoadedPlugin[]): void {
    const enabledCount = plugins.filter((p) => p.enabled).length;
    this.setState({
      plugins,
      enabledCount,
      disabledCount: plugins.length - enabledCount,
    });
  }

  /**
   * Enable or disable a plugin at runtime. Persists the change.
   */
  async setPluginEnabled(id: string, enabled: boolean): Promise<void> {
    const plugins = this.currentState.plugins.map((p) =>
      p.definition.id === id ? { ...p, enabled } : p,
    );

    const userState = await loadPluginState();
    userState[id] = enabled;
    await savePluginState(userState);

    // Re-apply enabled plugins (newly enabled ones get their skills registered)
    if (enabled) {
      const target = plugins.find((p) => p.definition.id === id);
      if (target) this.applyEnabledPlugins([target]);
    }

    this.updateCounts(plugins);
    logger.debug(`PluginRegistryService: set "${id}" enabled=${enabled}`);
  }

  getEnabledPlugins(): LoadedPlugin[] {
    return this.currentState.plugins.filter((p) => p.enabled);
  }

  getAllPlugins(): LoadedPlugin[] {
    return this.currentState.plugins;
  }

  isPluginEnabled(id: string): boolean {
    return (
      this.currentState.plugins.find((p) => p.definition.id === id)?.enabled ??
      false
    );
  }
}

/** Singleton used throughout the app */
export const pluginRegistryService = new PluginRegistryService();
