import { ConfigResult } from "@continuedev/config-yaml";

import { ControlPlaneClient } from "../../control-plane/client.js";
import { ContinueConfig, IDE, ILLMLogger } from "../../index.js";
import { ProfileDescription } from "../ProfileLifecycleManager.js";

import { getPrimaryConfigFilePath } from "../../util/paths.js";
import { localPathToUri } from "../../util/pathToUri.js";
import { getUriPathBasename } from "../../util/uri.js";
import doLoadConfig from "./doLoadConfig.js";
import { IProfileLoader } from "./IProfileLoader.js";

export default class LocalProfileLoader implements IProfileLoader {
  static ID = "local";

  description: ProfileDescription;

  constructor(
    private ide: IDE,
    private controlPlaneClient: ControlPlaneClient,
    private llmLogger: ILLMLogger,
    private overrideAssistantFile?:
      | { path: string; content: string }
      | undefined,
  ) {
    this.description = {
      id: overrideAssistantFile?.path ?? LocalProfileLoader.ID,
      profileType: "local",
      fullSlug: {
        ownerSlug: "",
        packageSlug: "",
        versionSlug: "",
      },
      iconUrl: "",
      title: overrideAssistantFile?.path
        ? getUriPathBasename(overrideAssistantFile.path)
        : "Local Config",
      errors: undefined,
      uri:
        overrideAssistantFile?.path ??
        localPathToUri(getPrimaryConfigFilePath()),
      rawYaml: undefined,
    };
  }

  async doLoadConfig(): Promise<ConfigResult<ContinueConfig>> {
    const result = await doLoadConfig({
      ide: this.ide,
      controlPlaneClient: this.controlPlaneClient,
      llmLogger: this.llmLogger,
      profileId: this.description.id,
      overrideConfigYamlByPath: this.overrideAssistantFile?.path,
      orgScopeId: null,
      packageIdentifier: {
        uriType: "file",
        fileUri: this.overrideAssistantFile?.path ?? getPrimaryConfigFilePath(),
        // Pass pre-read content to bypass fs.readFileSync, which fails for
        // vscode-remote:// URIs when Windows host connects to WSL (#10450)
        content: this.overrideAssistantFile?.content,
      },
    });

    this.description.errors = result.errors;

    // Use the config name from the loaded config (avoids duplicate file reads
    // and works in environments like WSL where paths may differ)
    if (result.configName) {
      this.description.title = result.configName;
    }

    return result;
  }

  setIsActive(isActive: boolean): void {}
}
