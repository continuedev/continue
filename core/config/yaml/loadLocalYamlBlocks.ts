import {
  AssistantUnrolled,
  ConfigResult,
  PackageIdentifier,
  RegistryClient,
  unrollAssistantFromContent,
} from "@continuedev/config-yaml";
import { IDE } from "../..";
<<<<<<< HEAD
import { ControlPlaneClient } from "../../control-plane/client";
=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
import { LocalPlatformClient } from "./LocalPlatformClient";

// This is a certain approach to unrolling local YAML where it
// 1. creates an assistant out of all local blocks
// 2. unrolls it like a local assistant
export async function unrollLocalYamlBlocks(
  packageIdentifiers: PackageIdentifier[],
  ide: IDE,
  registryClient: RegistryClient,
<<<<<<< HEAD
  orgScopeId: string | null,
  controlPlaneClient: ControlPlaneClient,
=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
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
<<<<<<< HEAD
        onPremProxyUrl: null,
        orgScopeId,
        platformClient: new LocalPlatformClient(
          orgScopeId,
          controlPlaneClient,
          ide,
        ),
=======
        platformClient: new LocalPlatformClient(ide),
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
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
