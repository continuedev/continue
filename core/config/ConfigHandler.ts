import { ControlPlaneClient } from "../control-plane/client.js";
import {
  BrowserSerializedContinueConfig,
  ContinueConfig,
  IContextProvider,
  IDE,
  IdeSettings,
  ILLM,
} from "../index.js";
import { GlobalContext } from "../util/GlobalContext.js";
import { finalToBrowserConfig } from "./load.js";
import ControlPlaneProfileLoader from "./profile/ControlPlaneProfileLoader.js";
import { IProfileLoader } from "./profile/IProfileLoader.js";
import LocalProfileLoader from "./profile/LocalProfileLoader.js";

export interface ProfileDescription {
  title: string;
  id: string;
}

// Separately manages saving/reloading each profile
class ProfileLifecycleManager {
  private savedConfig: ContinueConfig | undefined;
  private savedBrowserConfig?: BrowserSerializedContinueConfig;
  private pendingConfigPromise?: Promise<ContinueConfig>;

  constructor(private readonly profileLoader: IProfileLoader) {}

  get profileId() {
    return this.profileLoader.profileId;
  }

  get profileTitle() {
    return this.profileLoader.profileTitle;
  }

  get profileDescription(): ProfileDescription {
    return {
      title: this.profileTitle,
      id: this.profileId,
    };
  }

  clearConfig() {
    this.savedConfig = undefined;
    this.savedBrowserConfig = undefined;
    this.pendingConfigPromise = undefined;
  }

  // Clear saved config and reload
  reloadConfig(): Promise<ContinueConfig> {
    this.savedConfig = undefined;
    this.savedBrowserConfig = undefined;
    this.pendingConfigPromise = undefined;

    return this.profileLoader.doLoadConfig();
  }

  async loadConfig(
    additionalContextProviders: IContextProvider[],
  ): Promise<ContinueConfig> {
    // If we already have a config, return it
    if (this.savedConfig) {
      return this.savedConfig;
    } else if (this.pendingConfigPromise) {
      return this.pendingConfigPromise;
    }

    // Set pending config promise
    this.pendingConfigPromise = new Promise(async (resolve, reject) => {
      const newConfig = await this.profileLoader.doLoadConfig();

      // Add registered context providers
      newConfig.contextProviders = (newConfig.contextProviders ?? []).concat(
        additionalContextProviders,
      );

      this.savedConfig = newConfig;
      resolve(newConfig);
    });

    // Wait for the config promise to resolve
    this.savedConfig = await this.pendingConfigPromise;
    this.pendingConfigPromise = undefined;
    return this.savedConfig;
  }

  async getSerializedConfig(
    additionalContextProviders: IContextProvider[],
  ): Promise<BrowserSerializedContinueConfig> {
    if (!this.savedBrowserConfig) {
      const continueConfig = await this.loadConfig(additionalContextProviders);
      this.savedBrowserConfig = finalToBrowserConfig(continueConfig);
    }
    return this.savedBrowserConfig;
  }
}

export class ConfigHandler {
  private readonly globalContext = new GlobalContext();
  private additionalContextProviders: IContextProvider[] = [];
  private profiles: ProfileLifecycleManager[];
  private selectedProfileId: string;

  // This will be the local profile
  private get fallbackProfile() {
    return this.profiles[0];
  }

  get currentProfile() {
    return (
      this.profiles.find((p) => p.profileId === this.selectedProfileId) ??
      this.fallbackProfile
    );
  }

  get inactiveProfiles() {
    return this.profiles.filter((p) => p.profileId !== this.selectedProfileId);
  }

  constructor(
    private readonly ide: IDE,
    private ideSettingsPromise: Promise<IdeSettings>,
    private readonly writeLog: (text: string) => Promise<void>,
    private readonly controlPlaneClient: ControlPlaneClient,
  ) {
    this.ide = ide;
    this.ideSettingsPromise = ideSettingsPromise;
    this.writeLog = writeLog;

    // Set local profile as default
    const localProfileLoader = new LocalProfileLoader(
      ide,
      ideSettingsPromise,
      writeLog,
    );
    this.profiles = [new ProfileLifecycleManager(localProfileLoader)];
    this.selectedProfileId = localProfileLoader.profileId;

    // Always load local profile immediately in case control plane doesn't load
    try {
      this.loadConfig();
    } catch (e) {
      console.error("Failed to load config: ", e);
    }

    // Load control plane profiles
    // TODO
    // Get the profiles and create their lifecycle managers
    this.controlPlaneClient.listWorkspaces().then(async (workspaces) => {
      workspaces.forEach((workspace) => {
        const profileLoader = new ControlPlaneProfileLoader(
          workspace.id,
          workspace.name,
          this.controlPlaneClient,
          ide,
          ideSettingsPromise,
          writeLog,
          this.reloadConfig.bind(this),
        );
        this.profiles.push(new ProfileLifecycleManager(profileLoader));
      });

      this.notifyProfileListeners(
        this.profiles.map((profile) => profile.profileDescription),
      );

      // Check the last selected workspace, and reload if it isn't local
      const workspaceId = await this.getWorkspaceId();
      const lastSelectedWorkspaceIds =
        this.globalContext.get("lastSelectedProfileForWorkspace") ?? {};
      const selectedWorkspaceId = lastSelectedWorkspaceIds[workspaceId];
      if (selectedWorkspaceId) {
        this.selectedProfileId = selectedWorkspaceId;
        this.loadConfig();
      } else {
        // Otherwise we stick with local profile, and record choice
        lastSelectedWorkspaceIds[workspaceId] = this.selectedProfileId;
        this.globalContext.update(
          "lastSelectedProfileForWorkspace",
          lastSelectedWorkspaceIds,
        );
      }
    });
  }

  async setSelectedProfile(profileId: string) {
    this.selectedProfileId = profileId;
    const newConfig = await this.loadConfig();
    this.notifyConfigListerners(newConfig);
  }

  // A unique ID for the current workspace, built from folder names
  private async getWorkspaceId(): Promise<string> {
    const dirs = await this.ide.getWorkspaceDirs();
    return dirs.join("&");
  }

  // Automatically refresh config when Continue-related IDE (e.g. VS Code) settings are changed
  updateIdeSettings(ideSettings: IdeSettings) {
    this.ideSettingsPromise = Promise.resolve(ideSettings);
    this.reloadConfig();
  }

  private profilesListeners: ((profiles: ProfileDescription[]) => void)[] = [];
  onDidChangeAvailableProfiles(
    listener: (profiles: ProfileDescription[]) => void,
  ) {
    this.profilesListeners.push(listener);
  }

  private notifyProfileListeners(profiles: ProfileDescription[]) {
    for (const listener of this.profilesListeners) {
      listener(profiles);
    }
  }

  private notifyConfigListerners(newConfig: ContinueConfig) {
    // Notify listeners that config changed
    for (const listener of this.updateListeners) {
      listener(newConfig);
    }
  }

  private updateListeners: ((newConfig: ContinueConfig) => void)[] = [];
  onConfigUpdate(listener: (newConfig: ContinueConfig) => void) {
    this.updateListeners.push(listener);
  }

  async reloadConfig() {
    // TODO: this isn't right, there are two different senses in which you want to "reload"
    const newConfig = await this.currentProfile.reloadConfig();
    this.inactiveProfiles.forEach((profile) => profile.clearConfig());
    this.notifyConfigListerners(newConfig);
  }

  getSerializedConfig(): Promise<BrowserSerializedContinueConfig> {
    return this.currentProfile.getSerializedConfig(
      this.additionalContextProviders,
    );
  }

  listProfiles(): ProfileDescription[] {
    return this.profiles.map((p) => p.profileDescription);
  }

  async loadConfig(): Promise<ContinueConfig> {
    return this.currentProfile.loadConfig(this.additionalContextProviders);
  }

  async llmFromTitle(title?: string): Promise<ILLM> {
    const config = await this.loadConfig();
    const model =
      config.models.find((m) => m.title === title) || config.models[0];
    if (!model) {
      throw new Error("No model found");
    }

    return model;
  }

  registerCustomContextProvider(contextProvider: IContextProvider) {
    this.additionalContextProviders.push(contextProvider);
    this.reloadConfig();
  }
}
