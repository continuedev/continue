import { ConfigResult } from "@continuedev/config-yaml";

import { ControlPlaneClient } from "../control-plane/client.js";
import {
  BrowserSerializedContinueConfig,
  ContinueConfig,
  IContextProvider,
  IDE,
  IdeSettings,
  ILLMLogger,
} from "../index.js";
import { GlobalContext } from "../util/GlobalContext.js";

import EventEmitter from "node:events";
import {
  AuthType,
  ControlPlaneSessionInfo,
} from "../control-plane/AuthTypes.js";
import { getControlPlaneEnv } from "../control-plane/env.js";
import { logger } from "../util/logger.js";
import { Telemetry } from "../util/posthog.js";
import {
  ASSISTANTS,
  getAllDotContinueDefinitionFiles,
  LoadAssistantFilesOptions,
} from "./loadLocalAssistants.js";
import LocalProfileLoader from "./profile/LocalProfileLoader.js";
import PlatformProfileLoader from "./profile/PlatformProfileLoader.js";
import {
  OrganizationDescription,
  OrgWithProfiles,
  ProfileDescription,
  ProfileLifecycleManager,
  SerializedOrgWithProfiles,
} from "./ProfileLifecycleManager.js";

export type { ProfileDescription };

type ConfigUpdateFunction = (payload: ConfigResult<ContinueConfig>) => void;

export class ConfigHandler {
  controlPlaneClient: ControlPlaneClient;
  private readonly globalContext = new GlobalContext();
  private globalLocalProfileManager: ProfileLifecycleManager;

  private organizations: OrgWithProfiles[] = [];
  currentProfile: ProfileLifecycleManager | null;
  currentOrg: OrgWithProfiles;
  totalConfigLoads: number = 0;

  public isInitialized: Promise<void>;
  private initter: EventEmitter;

  cascadeAbortController: AbortController;
  private abortCascade() {
    this.cascadeAbortController.abort();
    this.cascadeAbortController = new AbortController();
  }

  constructor(
    private readonly ide: IDE,
    private ideSettingsPromise: Promise<IdeSettings>,
    private llmLogger: ILLMLogger,
    sessionInfoPromise: Promise<ControlPlaneSessionInfo | undefined>,
  ) {
    this.ide = ide;
    this.ideSettingsPromise = ideSettingsPromise;

    this.controlPlaneClient = new ControlPlaneClient(
      sessionInfoPromise,
      ideSettingsPromise,
      this.ide.getIdeInfo(),
    );

    // This profile manager will always be available
    this.globalLocalProfileManager = new ProfileLifecycleManager(
      new LocalProfileLoader(
        ide,
        ideSettingsPromise,
        this.controlPlaneClient,
        this.llmLogger,
      ),
      this.ide,
    );

    // Just to be safe, always force a default personal org with local profile manager
    this.currentProfile = this.globalLocalProfileManager;
    const personalOrg: OrgWithProfiles = {
      currentProfile: this.globalLocalProfileManager,
      profiles: [this.globalLocalProfileManager],
      ...this.PERSONAL_ORG_DESC,
    };

    this.currentOrg = personalOrg;
    this.organizations = [personalOrg];

    this.initter = new EventEmitter();
    this.isInitialized = new Promise((resolve) => {
      this.initter.on("init", resolve);
    });

    this.cascadeAbortController = new AbortController();
    void this.cascadeInit("Config handler initialization");
  }

  private workspaceDirs: string[] | null = null;
  async getWorkspaceId() {
    if (!this.workspaceDirs) {
      this.workspaceDirs = await this.ide.getWorkspaceDirs();
    }
    return this.workspaceDirs.join("&");
  }

  async getProfileKey(orgId: string) {
    const workspaceId = await this.getWorkspaceId();
    return `${workspaceId}:::${orgId}`;
  }

  private async cascadeInit(reason: string) {
    const signal = this.cascadeAbortController.signal;
    this.workspaceDirs = null; // forces workspace dirs reload

    try {
      const orgs = await this.getOrgs();

      // Figure out selected org
      const workspaceId = await this.getWorkspaceId();
      const selectedOrgs =
        this.globalContext.get("lastSelectedOrgIdForWorkspace") ?? {};
      const currentSelection = selectedOrgs[workspaceId];

      const firstNonPersonal = orgs.find(
        (org) => org.id !== this.PERSONAL_ORG_DESC.id,
      );
      const fallback = firstNonPersonal ?? orgs[0];
      // note, ignoring case of zero orgs since should never happen

      let selectedOrg: OrgWithProfiles;
      if (!currentSelection) {
        selectedOrg = fallback;
      } else {
        const match = orgs.find((org) => org.id === currentSelection);
        if (match) {
          selectedOrg = match;
        } else {
          selectedOrg = fallback;
        }
      }

      if (signal.aborted) {
        return; // local only case, no`fetch to throw abort error
      }
      this.initter.emit("init");

      this.globalContext.update("lastSelectedOrgIdForWorkspace", {
        ...selectedOrgs,
        [workspaceId]: selectedOrg.id,
      });

      this.organizations = orgs;
      this.currentOrg = selectedOrg;
      this.currentProfile = selectedOrg.currentProfile;

      await this.reloadConfig(reason);
    } catch (e) {
      if (e instanceof Error && e.message.includes("AbortError")) {
        return;
      } else {
        this.initter.emit("init"); // Error case counts for initialization
        throw e;
      }
    }
  }

  private async getOrgs(): Promise<OrgWithProfiles[]> {
    const isSignedIn = await this.controlPlaneClient.isSignedIn();
    if (isSignedIn) {
      const orgDescs = await this.controlPlaneClient.listOrganizations();
      const orgs = await Promise.all([
        this.getPersonalHubOrg(),
        ...orgDescs.map((org) => this.getNonPersonalHubOrg(org)),
      ]);
      return orgs;
    } else {
      return [await this.getLocalOrg()];
    }
  }

  getSerializedOrgs(): SerializedOrgWithProfiles[] {
    return this.organizations.map((org) => ({
      iconUrl: org.iconUrl,
      id: org.id,
      name: org.name,
      slug: org.slug,
      profiles: org.profiles.map((profile) => profile.profileDescription),
      selectedProfileId: org.currentProfile?.profileDescription.id || null,
    }));
  }

  private async getHubProfiles(orgScopeId: string | null) {
    const assistants = await this.controlPlaneClient.listAssistants(orgScopeId);

    return await Promise.all(
      assistants.map(async (assistant) => {
        const profileLoader = await PlatformProfileLoader.create({
          configResult: {
            ...assistant.configResult,
            config: assistant.configResult.config,
          },
          ownerSlug: assistant.ownerSlug,
          packageSlug: assistant.packageSlug,
          iconUrl: assistant.iconUrl,
          versionSlug: assistant.configResult.config?.version ?? "latest",
          controlPlaneClient: this.controlPlaneClient,
          ide: this.ide,
          ideSettingsPromise: this.ideSettingsPromise,
          llmLogger: this.llmLogger,
          rawYaml: assistant.rawYaml,
          orgScopeId: orgScopeId,
        });

        return new ProfileLifecycleManager(profileLoader, this.ide);
      }),
    );
  }

  private async getNonPersonalHubOrg(
    org: OrganizationDescription,
  ): Promise<OrgWithProfiles> {
    const localProfiles = await this.getLocalProfiles({
      includeGlobal: false,
      includeWorkspace: true,
    });
    const profiles = [...(await this.getHubProfiles(org.id)), ...localProfiles];
    return this.rectifyProfilesForOrg(org, profiles);
  }

  private PERSONAL_ORG_DESC: OrganizationDescription = {
    iconUrl: "",
    id: "personal",
    name: "Personal",
    slug: undefined,
  };
  private async getPersonalHubOrg() {
    const localProfiles = await this.getLocalProfiles({
      includeGlobal: true,
      includeWorkspace: true,
    });
    const hubProfiles = await this.getHubProfiles(null);
    const profiles = [...hubProfiles, ...localProfiles];
    return this.rectifyProfilesForOrg(this.PERSONAL_ORG_DESC, profiles);
  }

  private async getLocalOrg() {
    const localProfiles = await this.getLocalProfiles({
      includeGlobal: true,
      includeWorkspace: true,
    });
    return this.rectifyProfilesForOrg(this.PERSONAL_ORG_DESC, localProfiles);
  }

  private async rectifyProfilesForOrg(
    org: OrganizationDescription,
    profiles: ProfileLifecycleManager[],
  ): Promise<OrgWithProfiles> {
    const profileKey = await this.getProfileKey(org.id);
    const selectedProfiles =
      this.globalContext.get("lastSelectedProfileForWorkspace") ?? {};

    const currentSelection = selectedProfiles[profileKey];

    const firstNonLocal = profiles.find(
      (profile) => profile.profileDescription.profileType !== "local",
    );
    const fallback =
      firstNonLocal ?? (profiles.length > 0 ? profiles[0] : null);

    let currentProfile: ProfileLifecycleManager | null;
    if (!currentSelection) {
      currentProfile = fallback;
    } else {
      const match = profiles.find(
        (profile) => profile.profileDescription.id === currentSelection,
      );
      if (match) {
        currentProfile = match;
      } else {
        currentProfile = fallback;
      }
    }

    if (currentProfile) {
      this.globalContext.update("lastSelectedProfileForWorkspace", {
        ...selectedProfiles,
        [profileKey]: currentProfile.profileDescription.id,
      });
    }

    return {
      ...org,
      profiles,
      currentProfile,
    };
  }

  async getLocalProfiles(options: LoadAssistantFilesOptions) {
    /**
     * Users can define as many local assistants as they want in a `.continue/assistants` folder
     */

    // Local customization disabled for on-premise deployments
    const env = await getControlPlaneEnv(this.ide.getIdeSettings());
    if (env.AUTH_TYPE === AuthType.OnPrem) {
      return [];
    }

    const localProfiles: ProfileLifecycleManager[] = [];

    if (options.includeGlobal) {
      localProfiles.push(this.globalLocalProfileManager);
    }

    if (options.includeWorkspace) {
      const assistantFiles = await getAllDotContinueDefinitionFiles(
        this.ide,
        options,
        ASSISTANTS,
      );
      const profiles = assistantFiles.map((assistant) => {
        return new LocalProfileLoader(
          this.ide,
          this.ideSettingsPromise,
          this.controlPlaneClient,
          this.llmLogger,
          assistant,
        );
      });
      const localAssistantProfiles = profiles.map(
        (profile) => new ProfileLifecycleManager(profile, this.ide),
      );
      localProfiles.push(...localAssistantProfiles);
    }

    return localProfiles;
  }

  //////////////////
  // External actions that can cause a cascading config refresh
  // Should not be used internally
  //////////////////
  async refreshAll() {
    await this.cascadeInit("External refresh all");
  }

  // Ide settings change: refresh session and cascade refresh from the top
  async updateIdeSettings(ideSettings: IdeSettings) {
    this.ideSettingsPromise = Promise.resolve(ideSettings);
    this.abortCascade();
    await this.cascadeInit("IDE settings update");
  }

  // Session change: refresh session and cascade refresh from the top
  async updateControlPlaneSessionInfo(
    sessionInfo: ControlPlaneSessionInfo | undefined,
  ) {
    this.controlPlaneClient = new ControlPlaneClient(
      Promise.resolve(sessionInfo),
      this.ideSettingsPromise,
      this.ide.getIdeInfo(),
    );
    this.abortCascade();
    await this.cascadeInit("Control plane session info update");
  }

  // Org id: check id validity, save selection, switch and reload
  async setSelectedOrgId(orgId: string, profileId?: string) {
    if (orgId === this.currentOrg.id) {
      return;
    }
    const org = this.organizations.find((org) => org.id === orgId);
    if (!org) {
      throw new Error(`Org ${orgId} not found`);
    }

    const workspaceId = await this.getWorkspaceId();
    const selectedOrgs =
      this.globalContext.get("lastSelectedOrgIdForWorkspace") ?? {};
    this.globalContext.update("lastSelectedOrgIdForWorkspace", {
      ...selectedOrgs,
      [workspaceId]: org.id,
    });

    this.currentOrg = org;

    if (profileId) {
      await this.setSelectedProfileId(profileId);
    } else {
      this.currentProfile = org.currentProfile;
      await this.reloadConfig("Selected org changed");
    }
  }

  // Profile id: check id validity, save selection, switch and reload
  async setSelectedProfileId(profileId: string) {
    if (
      this.currentProfile &&
      profileId === this.currentProfile.profileDescription.id
    ) {
      return;
    }
    const profile = this.currentOrg.profiles.find(
      (profile) => profile.profileDescription.id === profileId,
    );
    if (!profile) {
      throw new Error(`Profile ${profileId} not found in current org`);
    }

    const profileKey = await this.getProfileKey(this.currentOrg.id);
    const selectedProfiles =
      this.globalContext.get("lastSelectedProfileForWorkspace") ?? {};
    this.globalContext.update("lastSelectedProfileForWorkspace", {
      ...selectedProfiles,
      [profileKey]: profileId,
    });

    this.currentProfile = profile;
    await this.reloadConfig("Selected profile changed");
  }

  // Bottom level of cascade: refresh the current profile
  // IMPORTANT - must always refresh when switching profiles
  // Because of e.g. MCP singleton and docs service using things from config
  // Could improve this
  async reloadConfig(reason: string) {
    const startTime = performance.now();
    this.totalConfigLoads += 1;
    // console.log(`Reloading config (#${this.totalConfigLoads}): ${reason}`); // Uncomment to see config loading logs
    if (!this.currentProfile) {
      return {
        config: undefined,
        errors: [],
        configLoadInterrupted: true,
      };
    }

    for (const org of this.organizations) {
      for (const profile of org.profiles) {
        if (
          profile.profileDescription.id !==
          this.currentProfile.profileDescription.id
        ) {
          profile.clearConfig();
        }
      }
    }

    const { config, errors, configLoadInterrupted } =
      await this.currentProfile.reloadConfig(this.additionalContextProviders);

    this.notifyConfigListeners({ config, errors, configLoadInterrupted });

    // Track config loading telemetry
    const endTime = performance.now();
    const duration = endTime - startTime;
    void Telemetry.capture("config_reload", {
      duration,
      reason,
      totalConfigLoads: this.totalConfigLoads,
      configLoadInterrupted,
    });

    return { config, errors, configLoadInterrupted };
  }

  // Listeners setup - can listen to current profile updates
  private notifyConfigListeners(result: ConfigResult<ContinueConfig>) {
    for (const listener of this.updateListeners) {
      listener(result);
    }
  }

  private updateListeners: ConfigUpdateFunction[] = [];

  onConfigUpdate(listener: ConfigUpdateFunction) {
    this.updateListeners.push(listener);
  }

  // Methods for loading (without reloading) config
  // Serialized for passing to GUI
  // Load for just awaiting current config load promise for the profile
  async getSerializedConfig(): Promise<
    ConfigResult<BrowserSerializedContinueConfig>
  > {
    if (!this.currentProfile) {
      return {
        config: undefined,
        errors: [],
        configLoadInterrupted: true,
      };
    }
    return await this.currentProfile.getSerializedConfig(
      this.additionalContextProviders,
    );
  }

  async loadConfig(): Promise<ConfigResult<ContinueConfig>> {
    if (!this.currentProfile) {
      return {
        config: undefined,
        errors: [],
        configLoadInterrupted: true,
      };
    }
    await this.isInitialized;
    const config = await this.currentProfile.loadConfig(
      this.additionalContextProviders,
    );

    if (config.errors?.length) {
      logger.warn("Errors loading config: ", config.errors);
    }
    return config;
  }

  async openConfigProfile(
    profileId?: string,
    element?: { sourceFile?: string },
  ) {
    let openProfileId = profileId || this.currentProfile?.profileDescription.id;
    if (!openProfileId) {
      return;
    }
    const profile = this.currentOrg.profiles.find(
      (p) => p.profileDescription.id === openProfileId,
    );

    if (profile?.profileDescription.profileType === "local") {
      const configFile = element?.sourceFile ?? profile.profileDescription.uri;
      await this.ide.openFile(configFile);
    } else {
      const env = await getControlPlaneEnv(this.ide.getIdeSettings());
      await this.ide.openUrl(`${env.APP_URL}${openProfileId}`);
    }
  }

  // Ancient method of adding custom providers through vs code
  private additionalContextProviders: IContextProvider[] = [];
  registerCustomContextProvider(contextProvider: IContextProvider) {
    this.additionalContextProviders.push(contextProvider);
    void this.reloadConfig("Custom context provider registered");
  }
  /**
   * Retrieves the titles of additional context providers that are of type "submenu".
   *
   * @returns {string[]} An array of titles of the additional context providers that have a description type of "submenu".
   */
  getAdditionalSubmenuContextProviders(): string[] {
    return this.additionalContextProviders
      .filter((provider) => provider.description.type === "submenu")
      .map((provider) => provider.description.title);
  }
}
