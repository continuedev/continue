import { ConfigResult, FullSlug } from "@continuedev/config-yaml";

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
  ProfileDescription,
  ProfileLifecycleManager,
} from "./ProfileLifecycleManager.js";

export type { ProfileDescription };

type ConfigUpdateFunction = (payload: ConfigResult<ContinueConfig>) => void;

// Separately manages saving/reloading each profile

export class ConfigHandler {
  private readonly globalContext = new GlobalContext();
  private additionalContextProviders: IContextProvider[] = [];
  private profiles: ProfileLifecycleManager[] | null = null; // null until profiles are loaded
  private selectedProfileId: string | null = null;
  private localProfileManager: ProfileLifecycleManager;
  controlPlaneClient: ControlPlaneClient;

  initializedPromise: Promise<void>;

  constructor(
    private readonly ide: IDE,
    private ideSettingsPromise: Promise<IdeSettings>,
    private readonly writeLog: (text: string) => Promise<void>,
    sessionInfoPromise: Promise<ControlPlaneSessionInfo | undefined>,
    private readonly didSelectOrganization?: (orgId: string | null) => void,
  ) {
    this.ide = ide;
    this.ideSettingsPromise = ideSettingsPromise;
    this.writeLog = writeLog;
    this.controlPlaneClient = new ControlPlaneClient(
      sessionInfoPromise,
      ideSettingsPromise,
    );

    // Set local profile as default
    const localProfileLoader = new LocalProfileLoader(
      ide,
      ideSettingsPromise,
      this.controlPlaneClient,
      writeLog,
    );
    this.localProfileManager = new ProfileLifecycleManager(
      localProfileLoader,
      this.ide,
    );

    // Profiles are loaded asynchronously
    this.initializedPromise = new Promise((resolve, reject) => {
      this.init()
        .then(() => {
          resolve();
        })
        .catch((e) => {
          reject(e);
        });
    });
  }

  /**
   * Users can define as many local assistants as they want in a `.continue/assistants` folder
   */
  private async getLocalAssistantProfiles() {
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
    return profiles.map(
      (profile) => new ProfileLifecycleManager(profile, this.ide),
    );
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

  private async init() {
    try {
      await this.fetchControlPlaneProfiles();
    } catch (e) {
      // If this fails, make sure at least local profile is loaded
      console.error("Failed to fetch control plane profiles in init: ", e);
      await this.loadLocalProfilesOnly();
    }

    try {
      const configResult = await this.loadConfig();
      this.notifyConfigListeners(configResult);
    } catch (e) {
      console.error("Failed to load config: ", e);
    }
  }

  get currentProfile() {
    if (!this.selectedProfileId) {
      return null;
    }
    // IMPORTANT
    // We must fall back to null, not the first or local profiles
    // Because GUI must be the source of truth for selected profile
    return (
      this.profiles?.find(
        (p) => p.profileDescription.id === this.selectedProfileId,
      ) ?? null
    );
  }

  get inactiveProfiles() {
    return (this.profiles ?? []).filter(
      (p) => p.profileDescription.id !== this.selectedProfileId,
    );
  }

  async openConfigProfile(profileId?: string) {
    let openProfileId = profileId || this.selectedProfileId;
    const profile = this.profiles?.find(
      (p) => p.profileDescription.id === openProfileId,
    );
    if (profile?.profileDescription.profileType === "local") {
      const ideInfo = await this.ide.getIdeInfo();
      await this.ide.openFile(profile.profileDescription.uri);
    } else {
      const env = await getControlPlaneEnv(this.ide.getIdeSettings());
      await this.ide.openUrl(`${env.APP_URL}${openProfileId}`);
    }
  }

  async listOrganizations() {
    return await this.controlPlaneClient.listOrganizations();
  }

  async loadAssistantsForSelectedOrg() {
    // debugger;
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
      const assistants =
        await this.controlPlaneClient.listAssistants(selectedOrgId);

      const hubProfiles = await Promise.all(
        assistants.map(async (assistant) => {
          // debugger;
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
            this.reloadConfig.bind(this),
            assistant.rawYaml,
          );

          return new ProfileLifecycleManager(profileLoader, this.ide);
        }),
      );

      if (selectedOrgId === null) {
        // Personal
        const allLocalProfiles = await this.getAllLocalProfiles();
        profiles = [...hubProfiles, ...allLocalProfiles];
      } else {
        // Organization
        profiles = hubProfiles;
      }
    }

    await this.updateAvailableProfiles(profiles);
  }

  private async getAllLocalProfiles() {
    const localAssistantProfiles = await this.getLocalAssistantProfiles();
    return [this.localProfileManager, ...localAssistantProfiles];
  }

  private async loadLocalProfilesOnly() {
    const allLocalProfiles = await this.getAllLocalProfiles();
    await this.updateAvailableProfiles(allLocalProfiles);
  }

  private async updateAvailableProfiles(profiles: ProfileLifecycleManager[]) {
    this.profiles = profiles;

    // If the last selected profile is in the list choose that
    // Otherwise, choose the first profile
    const previouslySelectedProfileId =
      await this.getPersistedSelectedProfileId();

    // Check if the previously selected profile exists in the current profiles
    const profileExists = profiles.some(
      (profile) =>
        profile.profileDescription.id === previouslySelectedProfileId,
    );

    const selectedProfileId = profileExists
      ? previouslySelectedProfileId
      : (profiles[0]?.profileDescription.id ?? null);

    // Notify listeners
    const profileDescriptions = profiles.map(
      (profile) => profile.profileDescription,
    );
    this.notifyProfileListeners(profileDescriptions, selectedProfileId);
    await this.setSelectedProfile(selectedProfileId);
  }

  private platformProfilesRefreshInterval: NodeJS.Timeout | undefined;
  // We use this to keep track of whether we should reload the assistants
  private lastFullSlugsList: FullSlug[] = [];

  private fullSlugsListsDiffer(a: FullSlug[], b: FullSlug[]): boolean {
    if (a.length !== b.length) {
      return true;
    }
    for (let i = 0; i < a.length; i++) {
      if (a[i].ownerSlug !== b[i].ownerSlug) {
        return true;
      }
      if (a[i].packageSlug !== b[i].packageSlug) {
        return true;
      }
      if (a[i].versionSlug !== b[i].versionSlug) {
        return true;
      }
    }
    return false;
  }

  private async reloadHubAssistants() {
    const selectedOrgId = await this.getSelectedOrgId();
    const newFullSlugsList =
      await this.controlPlaneClient.listAssistantFullSlugs(selectedOrgId);

    if (newFullSlugsList) {
      const shouldReload = this.fullSlugsListsDiffer(
        newFullSlugsList,
        this.lastFullSlugsList,
      );
      if (shouldReload) {
        await this.loadAssistantsForSelectedOrg();
      }
      this.lastFullSlugsList = newFullSlugsList;
    }
  }

  private async fetchControlPlaneProfiles() {
    if (await useHub(this.ideSettingsPromise)) {
      clearInterval(this.platformProfilesRefreshInterval);
      await this.loadAssistantsForSelectedOrg();

      // Every 5 seconds we ask the platform whether there are any assistant updates in the last 5 seconds
      // If so, we do the full (more expensive) reload
      this.platformProfilesRefreshInterval = setInterval(
        this.reloadHubAssistants.bind(this),
        PlatformProfileLoader.RELOAD_INTERVAL,
      );
    } else {
      try {
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

        await this.updateAvailableProfiles(profiles);
      } catch (e: any) {
        console.error("Failed to load profiles: ", e);
        await this.loadLocalProfilesOnly();
      }
    }
  }

  async getPersistedSelectedProfileId(): Promise<string | null> {
    const workspaceId = await this.getWorkspaceId();
    const lastSelectedIds =
      this.globalContext.get("lastSelectedProfileForWorkspace") ?? {};
    return lastSelectedIds[workspaceId] ?? null;
  }

  async getSelectedOrgId(): Promise<string | null> {
    const selectedOrgs =
      this.globalContext.get("lastSelectedOrgIdForWorkspace") ?? {};
    const workspaceId = await this.getWorkspaceId();
    return selectedOrgs[workspaceId] ?? null;
  }

  async setSelectedOrgId(orgId: string | null) {
    const selectedOrgs =
      this.globalContext.get("lastSelectedOrgIdForWorkspace") ?? {};
    selectedOrgs[await this.getWorkspaceId()] = orgId;
    this.globalContext.update("lastSelectedOrgIdForWorkspace", selectedOrgs);
    this.didSelectOrganization?.(orgId);
  }

  async setSelectedProfile(profileId: string | null) {
    console.log(
      `Changing selected profile from ${this.selectedProfileId} to ${profileId}`,
    );
    this.selectedProfileId = profileId;
    const result = await this.loadConfig();
    this.notifyConfigListeners(result);
    const selectedProfiles =
      this.globalContext.get("lastSelectedProfileForWorkspace") ?? {};
    selectedProfiles[await this.getWorkspaceId()] = profileId;
    this.globalContext.update(
      "lastSelectedProfileForWorkspace",
      selectedProfiles,
    );
  }

  // A unique ID for the current workspace, built from folder names
  private async getWorkspaceId(): Promise<string> {
    const dirs = await this.ide.getWorkspaceDirs();
    return dirs.join("&");
  }

  // Automatically refresh config when Continue-related IDE (e.g. VS Code) settings are changed
  updateIdeSettings(ideSettings: IdeSettings) {
    this.ideSettingsPromise = Promise.resolve(ideSettings);
    void this.reloadConfig();
  }

  async updateControlPlaneSessionInfo(
    sessionInfo: ControlPlaneSessionInfo | undefined,
  ) {
    this.controlPlaneClient = new ControlPlaneClient(
      Promise.resolve(sessionInfo),
      this.ideSettingsPromise,
    );

    // After login, default to the first org as the selected org
    try {
      const orgs = await this.controlPlaneClient.listOrganizations();
      if (orgs.length) {
        await this.setSelectedOrgId(orgs[0].id);
      }
    } catch (e) {
      console.error("Failed to fetch control plane profiles: ", e);
    }

    this.fetchControlPlaneProfiles().catch(async (e) => {
      console.error("Failed to fetch control plane profiles: ", e);
      await this.loadLocalProfilesOnly();
      await this.reloadConfig();
    });
  }

  private profilesListeners: ((
    profiles: ProfileDescription[],
    selectedProfileId: string | null,
  ) => void)[] = [];
  onDidChangeAvailableProfiles(
    listener: (
      profiles: ProfileDescription[],
      selectedProfileId: string | null,
    ) => void,
  ) {
    this.profilesListeners.push(listener);
  }

  private notifyProfileListeners(
    profiles: ProfileDescription[],
    selectedProfileId: string | null,
  ) {
    for (const listener of this.profilesListeners) {
      listener(profiles, selectedProfileId);
    }
  }

  private notifyConfigListeners(result: ConfigResult<ContinueConfig>) {
    // Notify listeners that config changed
    for (const listener of this.updateListeners) {
      listener(result);
    }
  }

  private updateListeners: ConfigUpdateFunction[] = [];

  onConfigUpdate(listener: ConfigUpdateFunction) {
    this.updateListeners.push(listener);
  }

  // TODO: this isn't right, there are two different senses in which you want to "reload"
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

    if (config) {
      this.inactiveProfiles.forEach((profile) => profile.clearConfig());
    }

    this.notifyConfigListeners({ config, errors, configLoadInterrupted });
    return { config, errors, configLoadInterrupted };
  }

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

  listProfiles(): ProfileDescription[] | null {
    return this.profiles?.map((p) => p.profileDescription) ?? null;
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

  registerCustomContextProvider(contextProvider: IContextProvider) {
    this.additionalContextProviders.push(contextProvider);
    void this.reloadConfig();
  }
}
