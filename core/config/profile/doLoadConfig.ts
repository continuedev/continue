import {
  ContinueRcJson,
  IDE,
  IdeSettings,
  SerializedContinueConfig,
} from "../..";
import { ContinueProxyReranker } from "../../context/rerankers/ContinueProxyReranker";
import { ControlPlaneClient } from "../../control-plane/client";
import { TeamAnalytics } from "../../control-plane/TeamAnalytics";
import ContinueProxyEmbeddingsProvider from "../../indexing/embeddings/ContinueProxyEmbeddingsProvider";
import ContinueProxy from "../../llm/llms/stubs/ContinueProxy";
import { Telemetry } from "../../util/posthog";
import { loadFullConfigNode } from "../load";

export default async function doLoadConfig(
  ide: IDE,
  ideSettingsPromise: Promise<IdeSettings>,
  controlPlaneClient: ControlPlaneClient,
  writeLog: (message: string) => Promise<void>,
  overrideConfigJson: SerializedContinueConfig | undefined,
) {
  let workspaceConfigs: ContinueRcJson[] = [];
  try {
    workspaceConfigs = await ide.getWorkspaceConfigs();
  } catch (e) {
    console.warn("Failed to load workspace configs");
  }

  const ideInfo = await ide.getIdeInfo();
  const uniqueId = await ide.getUniqueId();
  const ideSettings = await ideSettingsPromise;
  const workOsAccessToken = await controlPlaneClient.getAccessToken();

  const newConfig = await loadFullConfigNode(
    ide,
    workspaceConfigs,
    ideSettings,
    ideInfo.ideType,
    uniqueId,
    writeLog,
    workOsAccessToken,
    overrideConfigJson,
  );
  newConfig.allowAnonymousTelemetry =
    newConfig.allowAnonymousTelemetry && (await ide.isTelemetryEnabled());

  // Setup telemetry only after (and if) we know it is enabled
  await Telemetry.setup(
    newConfig.allowAnonymousTelemetry ?? true,
    await ide.getUniqueId(),
    ideInfo.extensionVersion,
  );

  if (newConfig.analytics) {
    await TeamAnalytics.setup(
      newConfig.analytics as any, // TODO: Need to get rid of index.d.ts once and for all
      uniqueId,
      ideInfo.extensionVersion,
    );
  }

  [...newConfig.models, ...(newConfig.tabAutocompleteModels ?? [])].forEach(
    async (model) => {
      if (model.providerName === "continue-proxy") {
        (model as ContinueProxy).workOsAccessToken = workOsAccessToken;
      }
    },
  );

  if (newConfig.embeddingsProvider?.providerName === "continue-proxy") {
    (
      newConfig.embeddingsProvider as ContinueProxyEmbeddingsProvider
    ).workOsAccessToken = workOsAccessToken;
  }

  if (newConfig.reranker?.name === "continue-proxy") {
    (newConfig.reranker as ContinueProxyReranker).workOsAccessToken =
      workOsAccessToken;
  }

  return newConfig;
}
