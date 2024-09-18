import { ContinueProxyReranker } from "../../context/rerankers/ContinueProxyReranker.js";
import { ControlPlaneProxyInfo } from "../../control-plane/analytics/IAnalyticsProvider.js";
import {
  ControlPlaneClient,
  DEFAULT_CONTROL_PLANE_PROXY_URL,
} from "../../control-plane/client.js";
import { TeamAnalytics } from "../../control-plane/TeamAnalytics.js";
import {
  ContinueConfig,
  ContinueRcJson,
  IDE,
  IdeSettings,
  SerializedContinueConfig,
} from "../../index.js";
import ContinueProxyEmbeddingsProvider from "../../indexing/embeddings/ContinueProxyEmbeddingsProvider.js";
import ContinueProxy from "../../llm/llms/stubs/ContinueProxy.js";
import { Telemetry } from "../../util/posthog.js";
import { TTS } from "../../util/tts.js";
import { loadFullConfigNode } from "../load.js";

export default async function doLoadConfig(
  ide: IDE,
  ideSettingsPromise: Promise<IdeSettings>,
  controlPlaneClient: ControlPlaneClient,
  writeLog: (message: string) => Promise<void>,
  overrideConfigJson: SerializedContinueConfig | undefined,
  workspaceId?: string,
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

  let newConfig = await loadFullConfigNode(
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
    ideInfo,
  );

  // TODO: pass config to pre-load non-system TTS models
  await TTS.setup();

  // Set up control plane proxy if configured
  let controlPlaneProxyUrl: string =
    (newConfig as any).controlPlane?.proxyUrl ??
    DEFAULT_CONTROL_PLANE_PROXY_URL;
  if (!controlPlaneProxyUrl.endsWith("/")) {
    controlPlaneProxyUrl += "/";
  }
  const controlPlaneProxyInfo = {
    workspaceId,
    controlPlaneProxyUrl,
    workOsAccessToken,
  };

  if (newConfig.analytics) {
    await TeamAnalytics.setup(
      newConfig.analytics as any, // TODO: Need to get rid of index.d.ts once and for all
      uniqueId,
      ideInfo.extensionVersion,
      controlPlaneClient,
      controlPlaneProxyInfo,
    );
  }

  newConfig = await injectControlPlaneProxyInfo(
    newConfig,
    controlPlaneProxyInfo,
  );

  return newConfig;
}

// Pass ControlPlaneProxyInfo to objects that need it
async function injectControlPlaneProxyInfo(
  config: ContinueConfig,
  info: ControlPlaneProxyInfo,
): Promise<ContinueConfig> {
  [...config.models, ...(config.tabAutocompleteModels ?? [])].forEach(
    async (model) => {
      if (model.providerName === "continue-proxy") {
        (model as ContinueProxy).controlPlaneProxyInfo = info;
      }
    },
  );

  if (config.embeddingsProvider?.providerName === "continue-proxy") {
    (
      config.embeddingsProvider as ContinueProxyEmbeddingsProvider
    ).controlPlaneProxyInfo = info;
  }

  if (config.reranker?.name === "continue-proxy") {
    (config.reranker as ContinueProxyReranker).controlPlaneProxyInfo = info;
  }

  return config;
}
