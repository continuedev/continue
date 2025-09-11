import {
  AssistantUnrolled,
  ConfigResult,
  PackageIdentifier,
  RegistryClient,
  unrollAssistantFromContent,
} from "@continuedev/config-yaml";
import { IDE } from "../..";
import { ControlPlaneClient } from "../../control-plane/client";
import { LocalPlatformClient } from "./LocalPlatformClient";

// This is a certain approach to unrolling local YAML where it
// 1. creates an assistant out of all local blocks
// 2. unrolls it like a local assistant
export async function unrollLocalYamlBlocks(
  packageIdentifiers: PackageIdentifier[],
  ide: IDE,
  registryClient: RegistryClient,
  orgScopeId: string | null,
  controlPlaneClient: ControlPlaneClient,
): Promise<ConfigResult<AssistantUnrolled>> {
  try {
    const unrollResult = await unrollAssistantFromContent(
      {
        uriType: "file",
        fileUri: "",
      },
      "name: FILLER\nschema: v1\nversion: 0.0.1",
      registryClient,
      {
        currentUserSlug: "",
        onPremProxyUrl: null,
        orgScopeId,
        platformClient: new LocalPlatformClient(
          orgScopeId,
          controlPlaneClient,
          ide,
        ),
        renderSecrets: true,
        injectBlocks: packageIdentifiers,
      },
    );
    const config =
      "config" in unrollResult ? unrollResult.config : unrollResult;
    const errors = "errors" in unrollResult ? unrollResult.errors : [];
    return {
      config,
      errors,
      configLoadInterrupted: false,
    };
  } catch (error) {
    let message = "An unknown error occurred while loading local YAML blocks";
    if (error instanceof Error) {
      message += ": " + error.message;
    }
    return {
      config: undefined,
      errors: [{ message, fatal: false }],
      configLoadInterrupted: false,
    };
  }
}
