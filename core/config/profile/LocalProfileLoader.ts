import { ConfigResult, parseConfigYaml } from "@continuedev/config-yaml";
import fs from "fs";

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

  constructor(
    private ide: IDE,
    private controlPlaneClient: ControlPlaneClient,
    private llmLogger: ILLMLogger,
    private overrideAssistantFile?:
      | { path: string; content: string }
      | undefined,
  ) {
    const description: ProfileDescription = {
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
    this.description = description;

    const yamlContent = this.getProfileYamlContent();
    if (yamlContent) {
      try {
        const parsedAssistant = parseConfigYaml(yamlContent);
        this.description.title = parsedAssistant.name ?? this.description.title;
      } catch (e) {
        console.error("Failed to parse config file: ", e);
      }
    }
  }

  private getProfileYamlContent(): string | undefined {
    if (this.overrideAssistantFile?.content) {
      return this.overrideAssistantFile.content;
    }

    try {
      return fs.readFileSync(getPrimaryConfigFilePath(), "utf8");
    } catch {
      return undefined;
    }
  }
  description: ProfileDescription;

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
      },
    });

    this.description.errors = result.errors;

    return result;
  }

  setIsActive(isActive: boolean): void {}
}
