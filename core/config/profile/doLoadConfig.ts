import { ContinueProxyReranker } from "../../context/rerankers/ContinueProxyReranker.js";
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
import { ControlPlaneProvider } from "../../control-plane/provider";

export default async function doLoadConfig(
  ide: IDE,
  ideSettingsPromise: Promise<IdeSettings>,
  controlPlaneProviderPromise: Promise<ControlPlaneProvider>,
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
  const controlPlaneProvider = await controlPlaneProviderPromise;

  let newConfig = await loadFullConfigNode(
    ide,
    workspaceConfigs,
    ideSettings,
    controlPlaneProvider,
    ideInfo.ideType,
    uniqueId,
    writeLog,
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

  controlPlaneProvider.setProxy(workspaceId, (newConfig as any).controlPlane?.proxyUrl);

  if (newConfig.analytics) {
    await TeamAnalytics.setup(
      newConfig.analytics as any, // TODO: Need to get rid of index.d.ts once and for all
      uniqueId,
      ideInfo.extensionVersion,
      controlPlaneProvider,
    );
  }

  newConfig = await injectControlPlaneProxyInfo(
    newConfig,
    controlPlaneProvider,
  );

  return newConfig;
}

// Pass ControlPlaneProxyInfo to objects that need it
async function injectControlPlaneProxyInfo(
  config: ContinueConfig,
  provider: ControlPlaneProvider,
): Promise<ContinueConfig> {
  for (const model of [...config.models, ...(config.tabAutocompleteModels ?? [])]) {
    if (model.providerName === "continue-proxy") {
      (model as ContinueProxy).controlPlaneProxyInfo = provider.proxy;
    }
  }

  if (config.embeddingsProvider?.providerName === "continue-proxy") {
    (
      config.embeddingsProvider as ContinueProxyEmbeddingsProvider
    ).controlPlaneProxyInfo = provider.proxy;
  }

  if (config.reranker?.name === "continue-proxy") {
    (config.reranker as ContinueProxyReranker).controlPlaneProxyInfo = provider.proxy;
  }

  return config;
}
