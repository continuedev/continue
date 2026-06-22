import { ConfigResult } from "@continuedev/config-yaml";

<<<<<<< HEAD
import { ControlPlaneClient } from "../../control-plane/client.js";
=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
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
<<<<<<< HEAD
    private controlPlaneClient: ControlPlaneClient,
=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
    private llmLogger: ILLMLogger,
    private overrideAssistantFile?:
      | { path: string; content: string }
      | undefined,
  ) {
    this.description = {
      id: overrideAssistantFile?.path ?? LocalProfileLoader.ID,
<<<<<<< HEAD
      profileType: "local",
=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
      fullSlug: {
        ownerSlug: "",
        packageSlug: "",
        versionSlug: "",
      },
      iconUrl: "",
      title: overrideAssistantFile?.path
        ? getUriPathBasename(overrideAssistantFile.path)
<<<<<<< HEAD
        : "Local Config",
=======
        : "Main Config",
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
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
<<<<<<< HEAD
      controlPlaneClient: this.controlPlaneClient,
      llmLogger: this.llmLogger,
      profileId: this.description.id,
      overrideConfigYamlByPath: this.overrideAssistantFile?.path,
      orgScopeId: null,
=======
      llmLogger: this.llmLogger,
      profileId: this.description.id,
      overrideConfigYamlByPath: this.overrideAssistantFile?.path,
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
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
