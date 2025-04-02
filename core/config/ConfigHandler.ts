import { ConfigResult } from "@continuedev/config-yaml";

import {
  ControlPlaneClient,
  ControlPlaneSessionInfo,
} from "../control-plane/client.js";
import { getControlPlaneEnv, useHub } from "../control-plane/env.js";
import {
  BrowserSerializedContinueConfig,
  ContinueConfig,
  IContextProvider,
  IDE,
  IdeSettings,
  ILLM,
} from "../index.js";
import Ollama from "../llm/llms/Ollama.js";
import { GlobalContext } from "../util/GlobalContext.js";

import { getAllAssistantFiles } from "./loadLocalAssistants.js";
import {
  LOCAL_ONBOARDING_CHAT_MODEL,
  LOCAL_ONBOARDING_PROVIDER_TITLE,
} from "./onboarding.js";
import ControlPlaneProfileLoader from "./profile/ControlPlaneProfileLoader.js";
import LocalProfileLoader from "./profile/LocalProfileLoader.js";
import PlatformProfileLoader from "./profile/PlatformProfileLoader.js";
import {
  OrganizationDescription,
  ProfileDescription,
  ProfileLifecycleManager,
} from "./ProfileLifecycleManager.js";

export type { ProfileDescription };

type ConfigUpdateFunction = (payload: ConfigResult<ContinueConfig>) => void;

type OrgWithProfiles = OrganizationDescription & {
  profiles: ProfileLifecycleManager[];
  currentProfile: ProfileLifecycleManager | null;
};

// Continue for Teams: show local + assistants in single org
// Continue Hub: show personal org with local and personal assistants
// Not signed in: show local and personal assistants

export class ConfigHandler {
  controlPlaneClient: ControlPlaneClient;
  private readonly globalContext = new GlobalContext();
  private globalLocalProfileManager: ProfileLifecycleManager;

  private organizations: OrgWithProfiles[] = [];
  currentProfile: ProfileLifecycleManager;
  currentOrg: OrgWithProfiles | null = null;

  constructor(
    private readonly ide: IDE,
    private ideSettingsPromise: Promise<IdeSettings>,
    private readonly writeLog: (text: string) => Promise<void>,
    sessionInfoPromise: Promise<ControlPlaneSessionInfo | undefined>,
  ) {
    this.ide = ide;
    this.ideSettingsPromise = ideSettingsPromise;
    this.writeLog = writeLog;
    this.controlPlaneClient = new ControlPlaneClient(
      sessionInfoPromise,
      ideSettingsPromise,
    );

    // This profile manager will always be available
    this.globalLocalProfileManager = new ProfileLifecycleManager(
      new LocalProfileLoader(
        ide,
        ideSettingsPromise,
        this.controlPlaneClient,
        writeLog,
      ),
      this.ide,
    );

    // Just to be safe, always force a selected profile
    this.currentProfile = this.globalLocalProfileManager;
    this.personalOrg = {
      currentProfile: this.globalLocalProfileManager,
    };
    this.organizations = [this.personalOrg];

    void this.cascadeInit();
  }

  private workspaceDirs: string[] | null = null;
  async workspaceId() {
    if (!this.workspaceDirs) {
      this.workspaceDirs = await this.ide.getWorkspaceDirs();
    }
    return this.workspaceDirs.join("&");
  }

  private PERSONAL_ORG_ID = "personal";

  async openConfigProfile(profileId?: string) {
    let openProfileId = profileId || this.currentProfileId;
    const profile = this.profiles?.find(
      (p) => p.profileDescription.id === openProfileId,
    );
    if (profile?.profileDescription.profileType === "local") {
      await this.ide.openFile(profile.profileDescription.uri);
    } else {
      const env = await getControlPlaneEnv(this.ide.getIdeSettings());
      await this.ide.openUrl(`${env.APP_URL}${openProfileId}`);
    }
  }

  // Loads orgs
  // Loads all profiles for all orgs
  // Gets/infers selected org
  // Cascades org selection
  private async cascadeInit() {
    this.workspaceDirs = null; // forces workspace dirs reload

    const userId = await this.controlPlaneClient.userId;

    const orgs = this.controlPlaneClient.listOrganizations();
  }

  // Refresh cascades: org -> profiles -> config
  private async cascadeRefreshOrgs() {
    // loads orgs
    // gets last selected org from context
    // checks if valid
    // if valid sets selected org
    // if not valid defaults to hub org or personal if no hub and saves fallback in context
    // cascade refreshes profiles for all orgs
    await this.cascadeRefreshProfilesForAllOrgs();
    //   const selectedOrgs =
    //     this.globalContext.get("lastSelectedOrgIdForWorkspace") ?? {};
    //   selectedOrgs[await this.getWorkspaceId()] = orgId;
    //   this.globalContext.update("lastSelectedOrgIdForWorkspace", selectedOrgs);
  }

  private async cascadeRefreshProfilesForAllOrgs() {
    await Promise.all(
      this.organizations.map((org) =>
        this.cascadeRefreshProfilesForOrg(org.id),
      ),
    );
  }

  private async cascadeRefreshProfilesForOrg(orgId: string | null) {
    // personal org: local profiles + personal hub if signed in
    //
    const workspaceId = await this.workspaceId();
    const contextKey = `${workspaceId}:::${orgId ?? this.PERSONAL_ORG_ID}`;

    // loads assistants
    // gets last selected profile from context (by org id/workspace id combo)
    // checks if valid
    // if valid sets selected profile
    // if not valid defaults to hub/teams profiles otherwise local, and and saves fallback in context
    // reloads config for selected profile

    await this.reloadConfig();
  }

  // Selection cascades: org -> profiles -> config
  private async cascadeSelectOrg() {}

  /*
  This rectifies selected ids to make sure no invalid state is reached
  And walks through the config profile tree logic
  Should be the default whenever a refresh is needed
  */
  private async cascadeConfigRefresh() {
    let resolvedOrgId = this._selectedOrgId;
    let resolvedProfileId = this.currentProfileId;

    // private async updateAvailableProfiles(profiles: ProfileLifecycleManager[]) {
    //   this.profiles = profiles;

    //   // If the last selected profile is in the list choose that
    //   // Otherwise, choose the first profile
    //   const previouslySelectedProfileId =
    //     await this.getPersistedSelectedProfileId();

    //   // Check if the previously selected profile exists in the current profiles
    //   const profileExists = profiles.some(
    //     (profile) =>
    //       profile.profileDescription.id === previouslySelectedProfileId,
    //   );

    //   const selectedProfileId = profileExists
    //     ? previouslySelectedProfileId
    //     : (profiles[0]?.profileDescription.id ?? null);

    //   // Notify listeners
    //   const profileDescriptions = profiles.map(
    //     (profile) => profile.profileDescription,
    //   );
    //   this.notifyConfigListeners();
    //   this.notifyProfileListeners(profileDescriptions, selectedProfileId);
    //   await this.setSelectedProfile(selectedProfileId);
    // }

    // SET SELECTED PROFILE ID
    const result = await this.loadConfig();
    this.notifyConfigListeners(result);

    const selectedProfiles =
      this.globalContext.get("lastSelectedProfileForWorkspace") ?? {};
    selectedProfiles[await getWorkspaceId()] = profileId;
    this.globalContext.update(
      "lastSelectedProfileForWorkspace",
      selectedProfiles,
    );

    // OTHER CASCADE STUFF
    // async getPersistedSelectedProfileId(): Promise<string | null> {
    //   const workspaceId = await this.getWorkspaceId();
    //   const lastSelectedIds =
    //     this.globalContext.get("lastSelectedProfileForWorkspace") ?? {};
    //   return lastSelectedIds[workspaceId] ?? null;
    // }

    // async getSelectedOrgId(): Promise<string | null> {
    //   const selectedOrgs =
    //     this.globalContext.get("lastSelectedOrgIdForWorkspace") ?? {};
    //   const workspaceId = await this.getWorkspaceId();
    //   return selectedOrgs[workspaceId] ?? null;
    // }

    // async setSelectedOrgId(orgId: string | null) {

    // }
  }

  // Initialization:

  //////////////////
  // External actions that can cause a cascading config refresh
  // Should not be used internally
  //////////////////

  // Ide settings change: refresh session and cascade refresh from the top
  async updateIdeSettings(ideSettings: IdeSettings) {
    this.ideSettingsPromise = Promise.resolve(ideSettings);
    await this.cascadeInit();
  }

  // Session change: refresh session and cascade refresh from the top
  async updateControlPlaneSessionInfo(
    sessionInfo: ControlPlaneSessionInfo | undefined,
  ) {
    this.controlPlaneClient = new ControlPlaneClient(
      Promise.resolve(sessionInfo),
      this.ideSettingsPromise,
    );
    await this.cascadeInit();
  }

  // Org id: check id validity, cascade org selection
  async setSelectedOrgId(orgId: string | null) {
    if (orgId === (this.currentOrg?.id ?? null)) {
      return;
    }
    if (orgId) {
      const org = this.organizations.find((org) => org.id === orgId);
      if (!org) {
        throw new Error(`Org ${orgId} not found`);
      }
    }

    await this.cascadeSelectOrg(orgId);
  }

  async setSelectedProfileId(profileId: string | null) {
    if (profileId === (this.currentProfile?.profileDescription.id ?? null)) {
      return;
    }
    if (orgId) {
      const profile = this._organizations.find((org) => org.id === orgId);
      if (!profile) {
        throw new Error(`Profile ${profileId} not found in current org`);
      }
    }
    // if (config) {
    //   this.inactiveProfiles.forEach((profile) => profile.clearConfig());
    //   return (this.profiles ?? []).filter(
    //     (p) => p.profileDescription.id !== this.selectedProfileId,
    //   );
    // }
    await this.cascadeP(orgId);
  }

  async getControlPlaneAssistantsForOrg(
    orgId: string,
  ): Promise<ProfileLifecycleManager[]> {
    if (await useHub(this.ideSettingsPromise)) {
      // Hub: only show org assistants within org
      const assistants = await this.controlPlaneClient.listAssistants(orgId);

      return await Promise.all(
        assistants.map(async (assistant) => {
          const profileLoader = await PlatformProfileLoader.create(
            {
              ...assistant.configResult,
              config: assistant.configResult.config,
            },
            assistant.ownerSlug,
            assistant.packageSlug,
            assistant.iconUrl,
            assistant.configResult.config?.version ?? "latest",
            this.controlPlaneClient,
            this.ide,
            this.ideSettingsPromise,
            this.writeLog,
            assistant.rawYaml,
            orgId,
          );

          return new ProfileLifecycleManager(profileLoader, this.ide);
        }),
      );
    } else {
      // Continue for teams: show local and teams profiles
      const workspaces = await this.controlPlaneClient.listWorkspaces();
      const profiles = await this.getAllLocalProfiles();
      workspaces.forEach((workspace) => {
        const profileLoader = new ControlPlaneProfileLoader(
          workspace.id,
          workspace.name,
          this.controlPlaneClient,
          this.ide,
          this.ideSettingsPromise,
          this.writeLog,
          this.reloadConfig.bind(this),
        );

        profiles.push(new ProfileLifecycleManager(profileLoader, this.ide));
      });
      return profiles;
    }
  }

  async getAllLocalProfiles() {
    /**
     * Users can define as many local assistants as they want in a `.continue/assistants` folder
     */
    const assistantFiles = await getAllAssistantFiles(this.ide);
    const profiles = assistantFiles.map((assistant) => {
      return new LocalProfileLoader(
        this.ide,
        this.ideSettingsPromise,
        this.controlPlaneClient,
        this.writeLog,
        assistant,
      );
    });
    const localAssistantProfiles = profiles.map(
      (profile) => new ProfileLifecycleManager(profile, this.ide),
    );
    return [this.globalLocalProfileManager, ...localAssistantProfiles];
  }

  async refreshAllAssistants(orgId: string | null) {
    // Get the profiles and create their lifecycle managers

    const userId = await this.controlPlaneClient.userId;
    const selectedOrgId = await this.getSelectedOrgId();

    let profiles: ProfileLifecycleManager[] | null = null;
    if (!userId) {
      // Not logged in
      const allLocalProfiles = await this.getAllLocalProfiles();
      profiles = [...allLocalProfiles];
    } else {
      // Logged in

      if (selectedOrgId === null) {
        // Personal
        const allLocalProfiles = await this.getAllLocalProfiles();
        profiles = [...hubProfiles, ...allLocalProfiles];
      } else {
        // Organization
        profiles = hubProfiles;
      }
    }

    this.profiles = profiles;
    await this.cascadeSelectOrg(orgId);
  }

  async cascadeSelectProfile(id: string) {}

  // Bottom level of cascade: refresh the current profile
  // IMPORTANT - must always refresh when switching profiles
  // Because of e.g. MCP singleton and docs service using things from config
  // Could improve this
  async reloadConfig() {
    if (!this.currentProfile) {
      return {
        config: undefined,
        errors: [],
        configLoadInterrupted: true,
      };
    }

    const { config, errors, configLoadInterrupted } =
      await this.currentProfile.reloadConfig(this.additionalContextProviders);

    this.notifyConfigListeners({ config, errors, configLoadInterrupted });
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
    return await this.currentProfile.loadConfig(
      this.additionalContextProviders,
    );
  }

  // Only used till we move to using selectedModelByRole.chat
  async llmFromTitle(title?: string): Promise<ILLM> {
    const { config } = await this.loadConfig();
    const model = config?.models.find((m) => m.title === title);
    if (!model) {
      if (title === LOCAL_ONBOARDING_PROVIDER_TITLE) {
        // Special case, make calls to Ollama before we have it in the config
        const ollama = new Ollama({
          model: LOCAL_ONBOARDING_CHAT_MODEL,
        });
        return ollama;
      } else if (config?.models?.length) {
        return config?.models[0];
      }

      throw new Error("No model found");
    }

    return model;
  }

  // Ancient method of adding custom providers through vs code
  private additionalContextProviders: IContextProvider[] = [];
  registerCustomContextProvider(contextProvider: IContextProvider) {
    this.additionalContextProviders.push(contextProvider);
    void this.reloadConfig();
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

// listProfileDescriptions(): ProfileDescription[] {
//   return this.profiles?.map((p) => p.profileDescription) ?? [];
// }
