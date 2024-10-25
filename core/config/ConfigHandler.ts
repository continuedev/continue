import {
  ControlPlaneClient,
  ControlPlaneSessionInfo,
} from "../control-plane/client.js";
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
import { ConfigResult } from "./load.js";
import {
  LOCAL_ONBOARDING_CHAT_MODEL,
  ONBOARDING_LOCAL_MODEL_TITLE,
} from "./onboarding.js";
import ControlPlaneProfileLoader from "./profile/ControlPlaneProfileLoader.js";
import LocalProfileLoader from "./profile/LocalProfileLoader.js";

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
  private profiles: ProfileLifecycleManager[];
  private selectedProfileId: string;

  constructor(
    private readonly ide: IDE,
    private ideSettingsPromise: Promise<IdeSettings>,
    private readonly writeLog: (text: string) => Promise<void>,
    private controlPlaneClient: ControlPlaneClient,
  ) {
    this.ide = ide;
    this.ideSettingsPromise = ideSettingsPromise;
    this.writeLog = writeLog;

    // Set local profile as default
    const localProfileLoader = new LocalProfileLoader(
      ide,
      ideSettingsPromise,
      controlPlaneClient,
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
    this.fetchControlPlaneProfiles();
  }

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

  private async fetchControlPlaneProfiles() {
    // Get the profiles and create their lifecycle managers
    this.controlPlaneClient
      .listWorkspaces()
      .then(async (workspaces) => {
        this.profiles = this.profiles.filter(
          (profile) => profile.profileId === "local",
        );
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
          await this.loadConfig();
        } else {
          // Otherwise we stick with local profile, and record choice
          lastSelectedWorkspaceIds[workspaceId] = this.selectedProfileId;
          this.globalContext.update(
            "lastSelectedProfileForWorkspace",
            lastSelectedWorkspaceIds,
          );
        }
      })
      .catch((e) => {
        console.error(e);
      });
  }

  async setSelectedProfile(profileId: string) {
    this.selectedProfileId = profileId;
    const newConfig = await this.loadConfig();
    this.notifyConfigListeners({
      config: newConfig,
      errors: undefined,
      configLoadInterrupted: false,
    });
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
    this.reloadConfig();
  }

  updateControlPlaneSessionInfo(
    sessionInfo: ControlPlaneSessionInfo | undefined,
  ) {
    this.controlPlaneClient = new ControlPlaneClient(
      Promise.resolve(sessionInfo),
    );
    this.fetchControlPlaneProfiles().catch((e) => {
      console.error("Failed to fetch control plane profiles: ", e);
    });
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

  async reloadConfig() {
    // TODO: this isn't right, there are two different senses in which you want to "reload"

    const { config, errors, configLoadInterrupted } =
      await this.currentProfile.reloadConfig();

    if (config) {
      this.inactiveProfiles.forEach((profile) => profile.clearConfig());
    }

    this.notifyConfigListeners({ config, errors, configLoadInterrupted });
    return { config, errors };
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
    const model = config.models.find((m) => m.title === title);
    if (!model) {
      if (title === ONBOARDING_LOCAL_MODEL_TITLE) {
        // Special case, make calls to Ollama before we have it in the config
        const ollama = new Ollama({
          model: LOCAL_ONBOARDING_CHAT_MODEL,
        });
        return ollama;
      } else if (config.models.length > 0) {
        return config.models[0];
      }

      throw new Error("No model found");
    }

    return model;
  }

  registerCustomContextProvider(contextProvider: IContextProvider) {
    this.additionalContextProviders.push(contextProvider);
    this.reloadConfig();
  }
}
