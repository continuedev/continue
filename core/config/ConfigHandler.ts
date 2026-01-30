import {
  BrowserSerializedContinueConfig,
  ContinueConfig,
  SlashCommandDescWithSource,
  SlashCommandWithSource,
} from "../index.js";

import type { ConfigResult } from "@continuedev/config-yaml";
import { ModelRole } from "@continuedev/config-yaml";
import { SerializedOrgWithProfiles } from "../config/ProfileLifecycleManager.js";

import { AIRGAPPED_CONFIG } from "./airgappedConfig";

import type { ProfileDescription } from "./ProfileLifecycleManager";

const AIRGAPPED_PROFILE_DESCRIPTION: ProfileDescription = {
  id: "local",
  title: "Local",
  fullSlug: {
    ownerSlug: "local",
    packageSlug: "local",
    versionSlug: "local",
  },
  profileType: "local",
  uri: "",
  iconUrl: "",
  errors: undefined,
};

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

/**
 * Convert runtime ILLM → UI ModelDescription
 */
function serializeModel(llm: any) {
  return {
    title: llm.title ?? llm.model,
    provider: llm.providerName ?? llm.provider ?? "unknown",
    underlyingProviderName:
      llm.underlyingProviderName ?? llm.providerName ?? "unknown",
    model: llm.model,
    contextLength: llm.contextLength,
    completionOptions: llm.completionOptions,
    capabilities: llm.capabilities,
    roles: llm.roles,
    configurationStatus: llm.getConfigurationStatus?.(),
  };
}

function serializeModelsByRole(
  modelsByRole: Record<ModelRole, any[]>,
): Record<ModelRole, any[]> {
  const out = {} as Record<ModelRole, any[]>;
  for (const role of Object.keys(modelsByRole) as ModelRole[]) {
    out[role] = (modelsByRole[role] ?? []).map(serializeModel);
  }
  return out;
}

function serializeSelectedModelByRole(
  selected: Record<ModelRole, any | null>,
): Record<ModelRole, any | null> {
  const out = {} as Record<ModelRole, any | null>;
  for (const role of Object.keys(selected) as ModelRole[]) {
    out[role] = selected[role] ? serializeModel(selected[role]) : null;
  }
  return out;
}

/**
 * Minimal ConfigHandler for air-gapped mode.
 * Satisfies ALL Continue core call sites.
 */
export class ConfigHandler {
  public isInitialized: Promise<void>;

  /**
   * Core reads this in multiple places.
   * `uri` MUST exist.
   */
  public currentProfile = {
    profileDescription: AIRGAPPED_PROFILE_DESCRIPTION,
  };

  public currentOrg: {
    id: string;
    profiles: { profileDescription: ProfileDescription }[];
  } = {
    id: "personal",
    profiles: [],
  };

  /**
   * Stubbed control plane — MUST exist.
   */
  public controlPlaneClient = {
    shouldEnableRemoteSessions: async () => false,
    listRemoteSessions: async () => [],
    loadRemoteSession: async (_remoteId?: string) => {
      throw new Error("Remote sessions disabled (air-gapped)");
    },
    getCreditStatus: async () => ({
      optedInToFreeTrial: false,
      hasCredits: true,
      creditBalance: Infinity,
      hasPurchasedCredits: true,
    }),
    getAccessToken: async () => {
      throw new Error("Auth disabled (air-gapped)");
    },
  };

  // Constructor signature MUST match core/tests
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
  // Serialized config (UI / Webview)
  // ------------------------------------------------------------------

  async getSerializedConfig(): Promise<
    ConfigResult<BrowserSerializedContinueConfig>
  > {
    const cfg = AIRGAPPED_CONFIG;

    const serialized: BrowserSerializedContinueConfig = {
      usePlatform: false,

      allowAnonymousTelemetry: cfg.allowAnonymousTelemetry,
      completionOptions: cfg.completionOptions,
      requestOptions: cfg.requestOptions,
      disableIndexing: cfg.disableIndexing,
      disableSessionTitles: cfg.disableSessionTitles,
      userToken: cfg.userToken,
      ui: cfg.ui,
      experimental: cfg.experimental,
      analytics: cfg.analytics,
      docs: cfg.docs,

      slashCommands: serializeSlashCommands(cfg.slashCommands ?? []),

      contextProviders: (cfg.contextProviders ?? []).map((p) => p.description),

      tools: cfg.tools ?? [],
      rules: cfg.rules ?? [],
      mcpServerStatuses: cfg.mcpServerStatuses ?? [],

      modelsByRole: serializeModelsByRole(cfg.modelsByRole ?? EMPTY_MODELS),

      selectedModelByRole: serializeSelectedModelByRole(
        cfg.selectedModelByRole ?? EMPTY_SELECTED,
      ),
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

  onConfigUpdate(
    _listener: (result: ConfigResult<ContinueConfig>) => void,
  ): void {}

  // ------------------------------------------------------------------
  // Org / profile APIs
  // ------------------------------------------------------------------
  getSerializedOrgs(): SerializedOrgWithProfiles[] {
    if (!this.currentProfile) return [];

    return [
      {
        id: "personal",
        name: "Personal",
        slug: "personal",
        iconUrl: "",
        profiles: [this.currentProfile.profileDescription],
        selectedProfileId: this.currentProfile.profileDescription.id,
      },
    ];
  }

  async setSelectedOrgId(_orgId?: string, _profileId?: string): Promise<void> {}

  async setSelectedProfileId(_profileId?: string): Promise<void> {}

  async openConfigProfile(_profileId?: string): Promise<void> {}

  async refreshAll(_reason?: string): Promise<void> {}

  async updateIdeSettings(_settings?: any): Promise<void> {}

  async updateControlPlaneSessionInfo(_info?: any): Promise<boolean> {
    return false;
  }

  // ------------------------------------------------------------------
  // Context providers
  // ------------------------------------------------------------------

  getAdditionalSubmenuContextProviders(): string[] {
    return [];
  }
}
