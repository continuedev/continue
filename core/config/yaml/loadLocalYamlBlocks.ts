import {
  AssistantUnrolled,
  BLOCK_TYPES,
  ConfigResult,
  PackageIdentifier,
  RegistryClient,
  unrollAssistantFromContent,
} from "@continuedev/config-yaml";
import { IDE } from "../..";
import { ControlPlaneClient } from "../../control-plane/client";
import { getAllDotContinueDefinitionFiles } from "../loadLocalAssistants";
import { LocalPlatformClient } from "./LocalPlatformClient";

// This is a certain approach to unrolling local YAML where it
// 1. creates an assistant out of all local blocks
// 2. unrolls it like a local assistant
export async function getLocalPackageIdentifiers(ide: IDE) {
  const blockPromises = BLOCK_TYPES.map(async (blockType) => {
    const localBlocks = await getAllDotContinueDefinitionFiles(
      ide,
      { includeGlobal: true, includeWorkspace: true, fileExtType: "yaml" },
      blockType,
    );
    return localBlocks.map((b) => ({
      uriType: "file" as const,
      filePath: b.path,
    }));
  });

  const allLocalBlocks: PackageIdentifier[] = (
    await Promise.all(blockPromises)
  ).flat();
  return allLocalBlocks;
}

export async function unrollLocalYamlBlocks(
  packageIdentifiers: PackageIdentifier[],
  ide: IDE,
  getRegistryClient: () => RegistryClient,
  orgScopeId: string | null,
  controlPlaneClient: ControlPlaneClient,
): Promise<ConfigResult<AssistantUnrolled>> {
  try {
    if (packageIdentifiers.length === 0) {
      return {
        config: undefined,
        errors: [],
        configLoadInterrupted: false,
      };
    }

    const unrollResult = await unrollAssistantFromContent(
      {
        uriType: "file",
        filePath: "",
      },
      "name: FILLER\nschema: v1\nversion: 0.0.1",
      getRegistryClient(),
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
export function mergeUnrolledAssistants(
  base: AssistantUnrolled,
  blocks: AssistantUnrolled,
): AssistantUnrolled {
  return {
    ...base,
    rules: [...(base.rules ?? []), ...(blocks.rules ?? [])],
    models: [...(base.models ?? []), ...(blocks.models ?? [])],
    docs: [...(base.docs ?? []), ...(blocks.docs ?? [])],
    context: [...(base.context ?? []), ...(blocks.context ?? [])],
    data: [...(base.data ?? []), ...(blocks.data ?? [])],
    mcpServers: [...(base.mcpServers ?? []), ...(blocks.mcpServers ?? [])],
    prompts: [...(base.prompts ?? []), ...(blocks.prompts ?? [])],
  };
}
