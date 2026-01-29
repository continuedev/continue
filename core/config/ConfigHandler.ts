import {
  BrowserSerializedContinueConfig,
  ContinueConfig,
  SlashCommandDescWithSource,
  SlashCommandWithSource,
} from "../index.js";

import type { ConfigResult } from "@continuedev/config-yaml";
import { ModelRole } from "@continuedev/config-yaml";

import { AIRGAPPED_CONFIG } from "./airgappedConfig";

export type { ProfileDescription } from "./ProfileLifecycleManager";

const EMPTY_MODELS: Record<ModelRole, any[]> = {
  chat: [],
  autocomplete: [],
  embed: [],
  rerank: [],
  edit: [],
  apply: [],
  summarize: [],
  subagent: [],
};

const EMPTY_SELECTED: Record<ModelRole, any | null> = {
  chat: null,
  autocomplete: null,
  embed: null,
  rerank: null,
  edit: null,
  apply: null,
  summarize: null,
  subagent: null,
};

/**
 * Convert runtime slash commands → UI-safe descriptors
 */
function serializeSlashCommands(
  commands: SlashCommandWithSource[],
): SlashCommandDescWithSource[] {
  return commands.map((cmd) => ({
    name: cmd.name,
    description: cmd.description,
    params: cmd.params,
    source: cmd.source,
    sourceFile: cmd.sourceFile,
    slug: cmd.slug,
    isLegacy: Boolean(cmd.run),
  }));
}

export class ConfigHandler {
  public isInitialized: Promise<void>;

  // ------------------------------------------------------------------
  // Required public fields (core expects these)
  // ------------------------------------------------------------------

  public currentProfile = {
    profileDescription: {
      id: "airgapped",
      profileType: "local" as const,
      uri: undefined,
    },

    modelsByRole: {
      chat: [],
      autocomplete: [],
      embed: [],
      rerank: [],
      edit: [],
      apply: [],
      summarize: [],
      subagent: [],
    } satisfies Record<ModelRole, any[]>,

    selectedModelByRole: {
      chat: null,
      autocomplete: null,
      embed: null,
      rerank: null,
      edit: null,
      apply: null,
      summarize: null,
      subagent: null,
    } satisfies Record<ModelRole, any | null>,
  };

  public currentOrg: {
    id: string;
    profiles: any[];
  } | null = {
    id: "personal",
    profiles: [],
  };

  /**
   * Stubbed control plane client
   * Must satisfy ALL call sites in core.ts
   */
  public controlPlaneClient = {
    shouldEnableRemoteSessions: async () => false,

    listRemoteSessions: async () => {
      return [];
    },

    loadRemoteSession: async (_remoteId: string) => {
      throw new Error("Remote sessions are disabled in air-gapped mode");
    },

    getCreditStatus: async () => ({
      optedInToFreeTrial: false,
      hasCredits: true,
      creditBalance: Infinity,
      hasPurchasedCredits: true,
    }),

    getAccessToken: async () => {
      throw new Error("Authentication is disabled in air-gapped mode");
    },
  };

  // ------------------------------------------------------------------

  constructor(
    _ide?: any,
    _llmLogger?: any,
    _initialSessionInfoPromise?: Promise<any>,
  ) {
    this.isInitialized = Promise.resolve();
  }

  // ------------------------------------------------------------------
  // Runtime config
  // ------------------------------------------------------------------

  async loadConfig(): Promise<ConfigResult<ContinueConfig>> {
    return {
      config: AIRGAPPED_CONFIG,
      errors: undefined,
      configLoadInterrupted: false,
    };
  }

  async reloadConfig(_reason?: string): Promise<ConfigResult<ContinueConfig>> {
    return this.loadConfig();
  }

  // ------------------------------------------------------------------
  // Serialized config (for webview/UI)
  // ------------------------------------------------------------------

  async getSerializedConfig(): Promise<
    ConfigResult<BrowserSerializedContinueConfig>
  > {
    const cfg = AIRGAPPED_CONFIG;

    const serialized: BrowserSerializedContinueConfig = {
      usePlatform: false,
      slashCommands: serializeSlashCommands(cfg.slashCommands ?? []),
      contextProviders: (cfg.contextProviders ?? []).map((p) => p.description),
      tools: cfg.tools ?? [],
      rules: cfg.rules ?? [],
      docs: cfg.docs ?? [],
      mcpServerStatuses: cfg.mcpServerStatuses ?? [],

      allowAnonymousTelemetry: cfg.allowAnonymousTelemetry,
      completionOptions: cfg.completionOptions,
      requestOptions: cfg.requestOptions,
      disableIndexing: cfg.disableIndexing,
      disableSessionTitles: cfg.disableSessionTitles,
      userToken: cfg.userToken,
      ui: cfg.ui,
      experimental: cfg.experimental,
      analytics: cfg.analytics,

      modelsByRole: EMPTY_MODELS,
      selectedModelByRole: EMPTY_SELECTED,
    };

    return {
      config: serialized,
      errors: undefined,
      configLoadInterrupted: false,
    };
  }

  // ------------------------------------------------------------------
  // Event hooks
  // ------------------------------------------------------------------

  onConfigUpdate(_listener: (result: ConfigResult<ContinueConfig>) => void) {
    // no-op — config never changes
  }

  // ------------------------------------------------------------------
  // Org / profile APIs (stubbed)
  // ------------------------------------------------------------------

  getSerializedOrgs() {
    return [];
  }

  async setSelectedOrgId(_orgId?: string, _profileId?: string) {
    return;
  }

  async setSelectedProfileId(_profileId?: string) {
    return;
  }

  async openConfigProfile(_profileId?: string) {
    return;
  }

  async refreshAll(_reason?: string) {
    return;
  }

  async updateIdeSettings(_settings?: any) {
    return;
  }

  async updateControlPlaneSessionInfo(_info?: any) {
    return false;
  }

  // ------------------------------------------------------------------
  // Context providers
  // ------------------------------------------------------------------

  getAdditionalSubmenuContextProviders(): string[] {
    return [];
  }
}
