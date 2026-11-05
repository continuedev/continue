import { ConfigResult, ConfigValidationError } from "@continuedev/config-yaml";

import {
  BrowserSerializedContinueConfig,
  ContinueConfig,
  IContextProvider,
  IDE,
  IdeSettings,
  ILLMLogger,
} from "../index.js";
import { GlobalContext } from "../util/GlobalContext.js";
import { getConfigYamlPath, setSelectedConfigFile } from "../util/paths.js";

import EventEmitter from "node:events";
import { Logger } from "../util/Logger.js";

import {
  getAllDotContinueDefinitionFiles,
  LoadAssistantFilesOptions,
} from "./loadLocalAssistants.js";
import {
  ConfigLocation,
  createConfigFile,
  renameConfigFile,
  validateConfigName,
} from "./profileFiles.js";
import LocalProfileLoader from "./profile/LocalProfileLoader.js";
import type { ConfigFileContent } from "./providers/providerInstances.js";
import {
  ProfileDescription,
  ProfileLifecycleManager,
} from "./ProfileLifecycleManager.js";

export type { ProfileDescription };

type ConfigUpdateFunction = (payload: ConfigResult<ContinueConfig>) => void;

export class ConfigHandler {
  private readonly globalContext = new GlobalContext();
  private globalLocalProfileManager: ProfileLifecycleManager;

  private profiles: ProfileLifecycleManager[] = [];

  get profileDescriptions(): ProfileDescription[] {
    return this.profiles.map((p) => p.profileDescription);
  }
  currentProfile: ProfileLifecycleManager | null;
  totalConfigReloads: number = 0;

  public isInitialized: Promise<void>;
  private initter: EventEmitter;

  cascadeAbortController: AbortController;
  private abortCascade() {
    this.cascadeAbortController.abort();
    this.cascadeAbortController = new AbortController();
  }

  constructor(
    private readonly ide: IDE,
    private llmLogger: ILLMLogger,
  ) {
    // This profile manager will always be available
    this.globalLocalProfileManager = new ProfileLifecycleManager(
      new LocalProfileLoader(ide, this.llmLogger),
      this.ide,
    );

    this.currentProfile = null;
    this.profiles = [];

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

  private async cascadeInit(reason: string) {
    const signal = this.cascadeAbortController.signal;
    this.workspaceDirs = null; // forces workspace dirs reload

    this.globalLocalProfileManager = new ProfileLifecycleManager(
      new LocalProfileLoader(this.ide, this.llmLogger),
      this.ide,
    );

    try {
      const { profiles, errors } = await this.loadProfiles();

      // Figure out selected profile
      const workspaceId = await this.getWorkspaceId();
      const selectedProfiles =
        this.globalContext.get("lastSelectedProfileForWorkspace") ?? {};
      const currentSelection = selectedProfiles[workspaceId];

      const fallback = profiles.length > 0 ? profiles[0] : null;

      let selectedProfile: ProfileLifecycleManager | null;
      if (currentSelection) {
        const match = profiles.find(
          (profile) => profile.profileDescription.id === currentSelection,
        );
        selectedProfile = match ?? fallback;
      } else {
        selectedProfile = fallback;
      }

      if (signal.aborted) {
        return;
      }

      if (selectedProfile) {
        this.globalContext.update("lastSelectedProfileForWorkspace", {
          ...selectedProfiles,
          [workspaceId]: selectedProfile.profileDescription.id,
        });
      }

      this.profiles = profiles;
      this.setCurrentProfile(selectedProfile);

      await this.reloadConfig(reason, errors);
    } catch (e) {
      if (signal.aborted) {
        return;
      } else {
        this.initter.emit("init"); // Error case counts as init
        throw e;
      }
    }
  }

  private async loadProfiles(): Promise<{
    profiles: ProfileLifecycleManager[];
    errors?: ConfigValidationError[];
  }> {
    const errors: ConfigValidationError[] = [];
    try {
      const profiles = await this.getLocalProfiles({
        includeGlobal: true,
        includeWorkspace: true,
      });
      return { profiles };
    } catch (e) {
      errors.push({
        fatal: true,
        message: `Error loading local assistants${e instanceof Error ? ":\n" + e.message : ""}`,
      });
      return {
        profiles: [],
        errors,
      };
    }
  }

  async getLocalProfiles(options: LoadAssistantFilesOptions) {
    /**
     * Users can define as many local agents as they want in a `.continue/agents` (or previous .continue/assistants) folder
     */
    const localProfiles: ProfileLifecycleManager[] = [];

    if (options.includeGlobal) {
      localProfiles.push(this.globalLocalProfileManager);
    }

    if (options.includeWorkspace) {
      const yamlOptions = { ...options, fileExtType: "yaml" } as const;
      const allFiles = (
        await Promise.all([
          getAllDotContinueDefinitionFiles(this.ide, yamlOptions, "assistants"),
          getAllDotContinueDefinitionFiles(this.ide, yamlOptions, "agents"),
          getAllDotContinueDefinitionFiles(this.ide, yamlOptions, "configs"),
        ])
      ).flat();
      const profiles = allFiles.map((assistant) => {
        return new LocalProfileLoader(this.ide, this.llmLogger, assistant);
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
  async refreshAll(reason?: string) {
    await this.cascadeInit(reason ?? "External refresh all");
  }

  // Ide settings change: refresh session and cascade refresh from the top
  async updateIdeSettings(ideSettings: IdeSettings) {
    this.abortCascade();
    await this.cascadeInit("IDE settings update");
  }

  // Profile id: check id validity, save selection, switch and reload
  async setSelectedProfileId(profileId: string) {
    if (
      this.currentProfile &&
      profileId === this.currentProfile.profileDescription.id
    ) {
      return;
    }
    const profile = this.profiles.find(
      (profile) => profile.profileDescription.id === profileId,
    );
    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    const workspaceId = await this.getWorkspaceId();
    const selectedProfiles =
      this.globalContext.get("lastSelectedProfileForWorkspace") ?? {};
    this.globalContext.update("lastSelectedProfileForWorkspace", {
      ...selectedProfiles,
      [workspaceId]: profileId,
    });

    this.setCurrentProfile(profile);
    await this.reloadConfig("Selected profile changed");
  }

  private findProfile(profileId: string): ProfileLifecycleManager {
    const profile = this.profiles.find(
      (p) => p.profileDescription.id === profileId,
    );
    if (!profile) throw new Error(`Config ${profileId} not found`);
    return profile;
  }

  private async selectAfterRefresh(profileId: string) {
    const workspaceId = await this.getWorkspaceId();
    const selected =
      this.globalContext.get("lastSelectedProfileForWorkspace") ?? {};
    this.globalContext.update("lastSelectedProfileForWorkspace", {
      ...selected,
      [workspaceId]: profileId,
    });
  }

  /**
   * Create a config, empty or as a copy of another, and select it. Returns
   * the new config's profile id.
   */
  async createProfile(opts: {
    name: string;
    location: ConfigLocation;
    copyFrom?: string;
  }): Promise<string> {
    const invalid = validateConfigName(opts.name);
    if (invalid) throw new Error(invalid);
    let content: string | undefined;
    if (opts.copyFrom) {
      const source = this.findProfile(opts.copyFrom);
      const uri = source.profileDescription.uri;
      if (!/\.ya?ml$/i.test(uri)) {
        throw new Error("Only a YAML config can be duplicated.");
      }
      content = await this.ide.readFile(uri);
    }
    const id = await createConfigFile(this.ide, {
      name: opts.name,
      location: opts.location,
      content,
    });
    await this.selectAfterRefresh(id);
    await this.cascadeInit("Config created");
    return id;
  }

  /**
   * Rename a config. The main config keeps its file; another config's file
   * is renamed too, and its selection and model picks move with it.
   */
  async renameProfile(profileId: string, name: string): Promise<string> {
    const invalid = validateConfigName(name);
    if (invalid) throw new Error(invalid);
    const profile = this.findProfile(profileId);
    const isMain = profileId === LocalProfileLoader.ID;
    const uri = profile.profileDescription.uri;
    if (!/\.ya?ml$/i.test(uri)) {
      throw new Error("Only a YAML config can be renamed here.");
    }
    const newUri = await renameConfigFile(this.ide, uri, name, {
      moveFile: !isMain,
    });
    const newId = isMain ? profileId : newUri;
    if (newId !== profileId) {
      this.globalContext.moveProfileState(profileId, newId);
    }
    await this.cascadeInit("Config renamed");
    return newId;
  }

  /** Delete a config file. The main config cannot be deleted. */
  async deleteProfile(profileId: string): Promise<void> {
    if (profileId === LocalProfileLoader.ID) {
      throw new Error("The main config cannot be deleted.");
    }
    const profile = this.findProfile(profileId);
    await this.ide.removeFile(profile.profileDescription.uri);
    this.globalContext.moveProfileState(profileId, null);
    await this.cascadeInit("Config deleted");
  }

  /**
   * The YAML files of the local configs, for scanning (provider usage,
   * plaintext keys). Files that cannot be read are left out.
   */
  async getLocalConfigFiles(): Promise<ConfigFileContent[]> {
    const files: ConfigFileContent[] = [];
    for (const profile of this.profiles) {
      const { uri, title } = profile.profileDescription;
      if (!/\.ya?ml$/i.test(uri)) continue;
      try {
        files.push({
          uri,
          label: title,
          content: await this.ide.readFile(uri),
        });
      } catch {
        // Not readable (deleted since loading); nothing to scan.
      }
    }
    return files;
  }

  /** Switch profiles; GUI edits follow the selected config's file. */
  private setCurrentProfile(profile: ProfileLifecycleManager | null) {
    this.currentProfile = profile;
    const id = profile?.profileDescription.id;
    setSelectedConfigFile(
      !id || id === LocalProfileLoader.ID
        ? undefined
        : profile!.profileDescription.uri,
    );
  }

  // Bottom level of cascade: refresh the current profile
  // IMPORTANT - must always refresh when switching profiles
  // Because of e.g. MCP singleton and docs service using things from config
  // Could improve this
  async reloadConfig(reason: string, injectErrors?: ConfigValidationError[]) {
    const startTime = performance.now();
    this.totalConfigReloads += 1;
    // console.log(`Reloading config (#${this.totalConfigLoads}): ${reason}`); // Uncomment to see config loading logs
    if (!this.currentProfile) {
      const out = {
        config: undefined,
        errors: injectErrors,
        configLoadInterrupted: true,
      };
      this.notifyConfigListeners(out);
      return out;
    }

    for (const profile of this.profiles) {
      if (
        profile.profileDescription.id !==
        this.currentProfile.profileDescription.id
      ) {
        profile.clearConfig();
      }
    }

    const {
      config,
      errors = [],
      configLoadInterrupted,
    } = await this.currentProfile.reloadConfig(this.additionalContextProviders);

    if (injectErrors) {
      errors.unshift(...injectErrors);
    }

    this.notifyConfigListeners({ config, errors, configLoadInterrupted });

    this.initter.emit("init");

    if (errors.length) {
      Logger.error("Errors loading config: ", errors);
    }

    return {
      config,
      errors: errors.length ? errors : undefined,
      configLoadInterrupted,
    };
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
    await this.isInitialized;
    if (!this.currentProfile) {
      return {
        config: undefined,
        errors: undefined,
        configLoadInterrupted: true,
      };
    }
    return await this.currentProfile.getSerializedConfig(
      this.additionalContextProviders,
    );
  }

  async loadConfig(): Promise<ConfigResult<ContinueConfig>> {
    await this.isInitialized;
    if (!this.currentProfile) {
      return {
        config: undefined,
        errors: undefined,
        configLoadInterrupted: true,
      };
    }
    const config = await this.currentProfile.loadConfig(
      this.additionalContextProviders,
    );
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
    const profile = this.profiles.find(
      (p) => p.profileDescription.id === openProfileId,
    );
    if (!profile) {
      console.error(`Profile ${profileId} not found`);
      return;
    }

    getConfigYamlPath();
    const configFile = element?.sourceFile ?? profile.profileDescription.uri;
    await this.ide.openFile(configFile);
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
