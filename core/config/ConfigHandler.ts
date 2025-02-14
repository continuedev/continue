import * as fs from "node:fs";

import {
  AssistantUnrolled,
  ConfigResult,
  FullSlug,
} from "@continuedev/config-yaml";
import * as YAML from "yaml";

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
import { getConfigJsonPath, getConfigYamlPath } from "../util/paths.js";
import { localPathToUri } from "../util/pathToUri.js";

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
  ProfilesState,
  SessionState,
} from "./ProfileLifecycleManager.js";
import { clientRenderHelper } from "./yaml/clientRender.js";

type ConfigUpdateFunction = (payload: ConfigResult<ContinueConfig>) => void;

// Separately manages saving/reloading each profile

export class ConfigHandler {
  private readonly globalContext = new GlobalContext();
  private additionalContextProviders: IContextProvider[] = [];
  private profiles: ProfileLifecycleManager[];
  private selectedProfileId: string | null;
  private organizations: OrganizationDescription[] = [];
  private selectedOrgId: string | null;
  private localProfileManager: ProfileLifecycleManager;
  private sessionInfo: ControlPlaneSessionInfo | undefined;

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
    this.localProfileManager = new ProfileLifecycleManager(
      localProfileLoader,
      this.ide,
    );
    this.profiles = [this.localProfileManager];
    this.selectedProfileId = localProfileLoader.description.id;
    this.selectedOrgId = null;

    void this.init();
  }

  private async init() {
    // Always load local profile immediately in case control plane doesn't load
    try {
      await this.loadConfig();
    } catch (e) {
      console.error("Failed to load config: ", e);
    }

    const workspaceId = await this.getWorkspaceId();
    const lastSelectedOrgIds =
      this.globalContext.get("lastSelectedOrgIdForWorkspace") ?? {};
    const selectedOrgId = lastSelectedOrgIds[workspaceId];

    // We want to set the org ID before fetching control plane profiles
    if (selectedOrgId) {
      this.selectedOrgId = selectedOrgId;
    }

    await this.notifyAllListenersWithCurrentState();

    // Load control plane profiles
    void this.fetchControlPlaneProfiles();
  }

  /////////////// WORKSPACE SETTINGS ////////////////

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

  /////////////// CONTROL PLANE SESSION ////////////////
  private sessionListeners: ((sessionState: SessionState) => void)[] = [];
  onDidChangeSession(listener: (sessionState: SessionState) => void) {
    this.sessionListeners.push(listener);
  }

  private notifySessionListeners(sessionState: SessionState) {
    for (const listener of this.sessionListeners) {
      listener(sessionState);
    }
  }

  async updateControlPlaneSessionInfo(
    sessionInfo: ControlPlaneSessionInfo | undefined,
  ) {
    this.controlPlaneClient = new ControlPlaneClient(
      Promise.resolve(sessionInfo),
      this.ideSettingsPromise,
    );

    this.sessionInfo = sessionInfo;
    this.organizations = await this.controlPlaneClient.listOrganizations();

    await this.setSelectedOrg(this.selectedOrgId);

    // Trigger profile fetching
    this.fetchControlPlaneProfiles().catch((e) => {
      console.error("Failed to fetch control plane profiles: ", e);
    });
  }

  async setSelectedOrg(orgId: string | null) {
    // Rectify org id - clear if not found
    this.selectedOrgId = orgId;
    if (
      this.selectedOrgId &&
      !this.organizations.some((org) => org.id === this.selectedOrgId)
    ) {
      this.selectedOrgId = null;
    }

    this.selectedOrgId = orgId;
    const selectedOrgs =
      this.globalContext.get("lastSelectedOrgIdForWorkspace") ?? {};
    selectedOrgs[await this.getWorkspaceId()] = orgId;
    this.globalContext.update("lastSelectedOrgIdForWorkspace", selectedOrgs);

    this.notifySessionListeners({
      organizations: this.organizations,
      session: this.sessionInfo,
      selectedOrganizationId: this.selectedOrgId,
    });

    await this.reloadConfig();
  }

  /////////////// CONFIG PROFILES ////////////////

  // get selectedProfile(): ProfileLifecycleManager | null {
  //   if (this.profiles.length === 0) {
  //     return null;
  //   }
  //   if (!this.selectedProfileId) {
  //     return null;
  //   }
  //   const match = this.profiles.find(
  //     (p) => p.profileDescription.id === this.selectedProfileId,
  //   );
  //   if (match) {
  //     return match;
  //   }
  //   // If no match first try local
  //   const local = this.profiles.find(
  //     (p) => p.profileDescription.id === "local",
  //   );
  //   if (local) {
  //     this.selectedProfileId = "local";
  //     return local;
  //   }

  //   // Else return the first one
  //   this.selectedProfileId = this.profiles[0].profileDescription.id;
  //   return this.profiles[0];
  // }

  private profileListeners: ((profilesState: ProfilesState) => void)[] = [];
  onDidChangeProfiles(listener: (profilesState: ProfilesState) => void) {
    this.profileListeners.push(listener);
  }

  private notifyProfileListeners(profilesState: ProfilesState) {
    for (const listener of this.profileListeners) {
      listener(profilesState);
    }
  }

  get inactiveProfiles() {
    return this.profiles.filter(
      (p) => p.profileDescription.id !== this.selectedProfileId,
    );
  }

  private async loadPlatformProfiles() {
    // Get the profiles and create their lifecycle managers
    try {
      const assistants = await this.controlPlaneClient.listAssistants(
        this.selectedOrgId,
      );

      const hubProfiles = await Promise.all(
        assistants.map(async (assistant) => {
          let renderedConfig: AssistantUnrolled | undefined = undefined;
          if (assistant.configResult.config) {
            renderedConfig = await clientRenderHelper(
              YAML.stringify(assistant.configResult.config),
              this.ide,
              this.controlPlaneClient,
            );
          }

          const profileLoader = new PlatformProfileLoader(
            { ...assistant.configResult, config: renderedConfig },
            assistant.ownerSlug,
            assistant.packageSlug,
            assistant.iconUrl,
            assistant.configResult.config?.version ?? "latest",
            this.controlPlaneClient,
            this.ide,
            this.ideSettingsPromise,
            this.writeLog,
            this.reloadConfig.bind(this),
          );

          return new ProfileLifecycleManager(profileLoader, this.ide);
        }),
      );

      this.profiles =
        this.selectedOrgId === null
          ? [this.localProfileManager, ...hubProfiles]
          : hubProfiles;

      this.notifyProfileListeners(
        this.profiles.map((profile) => profile.profileDescription),
      );

      // Check the last selected workspace, and reload if it isn't local
      const workspaceId = await this.getWorkspaceId();
      const lastSelectedIds =
        this.globalContext.get("lastSelectedProfileForWorkspace") ?? {};

      const lastSelectedProfileId = lastSelectedIds[workspaceId];
      if (lastSelectedProfileId) {
        this.selectedProfileId = lastSelectedProfileId;
        await this.loadConfig();
      } else {
        // Otherwise we stick with local profile, and record choice
        lastSelectedIds[workspaceId] = this.selectedProfileId;
        this.globalContext.update(
          "lastSelectedProfileForWorkspace",
          lastSelectedIds,
        );
      }
    } catch (e) {
      console.error("Failed to list assistants", e);
    }
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

  private async fetchControlPlaneProfiles() {
    if (await useHub(this.ideSettingsPromise)) {
      clearInterval(this.platformProfilesRefreshInterval);
      await this.loadPlatformProfiles();

      // Every 5 seconds we ask the platform whether there are any assistant updates in the last 5 seconds
      // If so, we do the full (more expensive) reload
      this.platformProfilesRefreshInterval = setInterval(async () => {
        const newFullSlugsList =
          await this.controlPlaneClient.listAssistantFullSlugs(
            this.selectedOrgId,
          );

        if (newFullSlugsList) {
          const shouldReload = this.fullSlugsListsDiffer(
            newFullSlugsList,
            this.lastFullSlugsList,
          );
          if (shouldReload) {
            await this.loadPlatformProfiles();
          }
          this.lastFullSlugsList = newFullSlugsList;
        }
      }, PlatformProfileLoader.RELOAD_INTERVAL);
    } else {
      this.controlPlaneClient
        .listWorkspaces()
        .then(async (workspaces) => {
          this.profiles = [this.localProfileManager];
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
            this.profiles.push(
              new ProfileLifecycleManager(profileLoader, this.ide),
            );
          });

          this.notifyProfileListeners(
            this.profiles.map((profile) => profile.profileDescription),
          );

          // Check the last selected workspace, and reload if it isn't local
          const workspaceId = await this.getWorkspaceId();
          const lastSelectedIds =
            this.globalContext.get("lastSelectedProfileForWorkspace") ?? {};
          const lastSelectedProfileId = lastSelectedIds[workspaceId];
          if (lastSelectedProfileId) {
            this.selectedProfileId = lastSelectedProfileId;
            await this.loadConfig();
          } else {
            // Otherwise we stick with local profile, and record choice
            lastSelectedIds[workspaceId] = this.selectedProfileId;
            this.globalContext.update(
              "lastSelectedProfileForWorkspace",
              lastSelectedIds,
            );
          }

          void this.reloadConfig();
        })
        .catch((e) => {
          console.error(e);
        });
    }
  }

  async setSelectedProfile(profileId: string | null) {
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
    await this.reloadConfig();
  }

  listProfiles(): ProfileDescription[] {
    return this.profiles.map((p) => p.profileDescription);
  }

  /////////////// CONFIG LOADING ////////////////

  private updateListeners: ConfigUpdateFunction[] = [];

  onConfigUpdate(listener: ConfigUpdateFunction) {
    this.updateListeners.push(listener);
  }
  private notifyConfigListeners(result: ConfigResult<ContinueConfig>) {
    // Notify listeners that config changed
    for (const listener of this.updateListeners) {
      listener(result);
    }
  }

  // private async notifyAllListenersWithCurrentState() {
  //   this.notifySessionListeners({
  //     session: this.sessionInfo,
  //     organizations: this.organizations,
  //     selectedOrganizationId: this.selectedOrgId,
  //   });
  //   this.notifyProfileListeners({
  //     profiles: this.listProfiles(),
  //     selectedProfileId: this.selectedProfileId,
  //   });
  //   const result = await this.loadConfig();
  //   this.notifyConfigListeners(result);
  // }

  async reloadConfig() {
    // TODO: this isn't right, there are two different senses in which you want to "reload"
    if (!this.selectedProfile) {
      return;
    }

    const { config, errors, configLoadInterrupted } =
      await this.selectedProfile.reloadConfig(this.additionalContextProviders);

    if (config) {
      this.inactiveProfiles.forEach((profile) => profile.clearConfig());
    }

    this.notifyConfigListeners({ config, errors, configLoadInterrupted });
    return { config, errors };
  }

  async getSerializedConfig(): Promise<
    ConfigResult<BrowserSerializedContinueConfig>
  > {
    if (!this.selectedProfile) {
      return {
        config: undefined,
        errors: [],
        configLoadInterrupted: true,
      };
    }
    return await this.selectedProfile.getSerializedConfig(
      this.additionalContextProviders,
    );
  }

  async loadConfig(): Promise<ConfigResult<ContinueConfig>> {
    if (!this.selectedProfile) {
      return {
        config: undefined,
        errors: [],
        configLoadInterrupted: true,
      };
    }
    return await this.selectedProfile.loadConfig(
      this.additionalContextProviders,
    );
  }

  /////////////// OTHER ////////////////
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

  async openConfigProfile(profileId?: string) {
    let idToOpen = profileId || this.selectedProfile?.profileDescription.id;

    if (!idToOpen) {
      console.error(
        "Error opening config profile: id not provided and no profile selected",
      );
      return;
    }
    if (idToOpen === "local") {
      const ideInfo = await this.ide.getIdeInfo();
      const configYamlPath = getConfigYamlPath(ideInfo.ideType);
      if (fs.existsSync(configYamlPath)) {
        await this.ide.openFile(localPathToUri(configYamlPath));
      } else {
        await this.ide.openFile(localPathToUri(getConfigJsonPath()));
      }
    } else {
      const env = await getControlPlaneEnv(this.ide.getIdeSettings());

      await this.ide.openUrl(`${env.APP_URL}${idToOpen}`);
    }
  }
}
