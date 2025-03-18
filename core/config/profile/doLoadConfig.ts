import fs from "fs";

import {
  AssistantUnrolled,
  ConfigResult,
  ConfigValidationError,
  ModelRole,
} from "@continuedev/config-yaml";
import {
  ContinueConfig,
  ContinueRcJson,
  IDE,
  IdeSettings,
  SerializedContinueConfig,
} from "../../";
import { ControlPlaneProxyInfo } from "../../control-plane/analytics/IAnalyticsProvider.js";
import { ControlPlaneClient } from "../../control-plane/client.js";
import { getControlPlaneEnv } from "../../control-plane/env.js";
import { TeamAnalytics } from "../../control-plane/TeamAnalytics.js";
import ContinueProxy from "../../llm/llms/stubs/ContinueProxy";
import { getConfigJsonPath, getConfigYamlPath } from "../../util/paths";
import { localPathOrUriToPath } from "../../util/pathToUri";
import { Telemetry } from "../../util/posthog";
import { TTS } from "../../util/tts";
import { loadContinueConfigFromJson } from "../load";
import { migrateJsonSharedConfig } from "../migrateSharedConfig";
import { rectifySelectedModelsFromGlobalContext } from "../selectedModels";
import { loadContinueConfigFromYaml } from "../yaml/loadYaml";
import { PlatformConfigMetadata } from "./PlatformProfileLoader";

export default async function doLoadConfig(
  ide: IDE,
  ideSettingsPromise: Promise<IdeSettings>,
  controlPlaneClient: ControlPlaneClient,
  writeLog: (message: string) => Promise<void>,
  overrideConfigJson: SerializedContinueConfig | undefined,
  overrideConfigYaml: AssistantUnrolled | undefined,
  platformConfigMetadata: PlatformConfigMetadata | undefined,
  profileId: string,
  overrideConfigYamlByPath: string | undefined,
): Promise<ConfigResult<ContinueConfig>> {
  const workspaceConfigs = await getWorkspaceConfigs(ide);
  const ideInfo = await ide.getIdeInfo();
  const uniqueId = await ide.getUniqueId();
  const ideSettings = await ideSettingsPromise;
  const workOsAccessToken = await controlPlaneClient.getAccessToken();

  // Migrations for old config files
  // Removes
  const configJsonPath = getConfigJsonPath(ideInfo.ideType);
  if (fs.existsSync(configJsonPath)) {
    migrateJsonSharedConfig(configJsonPath, ide);
  }

  const configYamlPath = localPathOrUriToPath(
    overrideConfigYamlByPath || getConfigYamlPath(ideInfo.ideType),
  );

  let newConfig: ContinueConfig | undefined;
  let errors: ConfigValidationError[] | undefined;
  let configLoadInterrupted = false;

  if (overrideConfigYaml || fs.existsSync(configYamlPath)) {
    const result = await loadContinueConfigFromYaml(
      ide,
      workspaceConfigs.map((c) => JSON.stringify(c)),
      ideSettings,
      ideInfo,
      uniqueId,
      writeLog,
      workOsAccessToken,
      overrideConfigYaml,
      platformConfigMetadata,
      controlPlaneClient,
      configYamlPath,
    );
    newConfig = result.config;
    errors = result.errors;
    configLoadInterrupted = result.configLoadInterrupted;
  } else {
    const result = await loadContinueConfigFromJson(
      ide,
      workspaceConfigs,
      ideSettings,
      ideInfo,
      uniqueId,
      writeLog,
      workOsAccessToken,
      overrideConfigJson,
    );
    newConfig = result.config;
    errors = result.errors;
    configLoadInterrupted = result.configLoadInterrupted;
  }

  // Rectify model selections for each role
  if (newConfig) {
    newConfig = rectifySelectedModelsFromGlobalContext(newConfig, profileId);
  }

  if (configLoadInterrupted || !newConfig) {
    return { errors, config: newConfig, configLoadInterrupted: true };
  }

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
  const controlPlane = (newConfig as any).controlPlane;
  const useOnPremProxy =
    controlPlane?.useContinueForTeamsProxy === false && controlPlane?.proxyUrl;

  const env = await getControlPlaneEnv(ideSettingsPromise);
  let controlPlaneProxyUrl: string = useOnPremProxy
    ? controlPlane?.proxyUrl
    : env.DEFAULT_CONTROL_PLANE_PROXY_URL;

  if (!controlPlaneProxyUrl.endsWith("/")) {
    controlPlaneProxyUrl += "/";
  }
  const controlPlaneProxyInfo = {
    profileId,
    controlPlaneProxyUrl,
    workOsAccessToken,
  };

  if (newConfig.analytics) {
    await TeamAnalytics.setup(
      newConfig.analytics,
      uniqueId,
      ideInfo.extensionVersion,
      controlPlaneClient,
      controlPlaneProxyInfo,
    );
  } else {
    await TeamAnalytics.shutdown();
  }

  newConfig = await injectControlPlaneProxyInfo(
    newConfig,
    controlPlaneProxyInfo,
  );

  return { config: newConfig, errors, configLoadInterrupted: false };
}

// Pass ControlPlaneProxyInfo to objects that need it
async function injectControlPlaneProxyInfo(
  config: ContinueConfig,
  info: ControlPlaneProxyInfo,
): Promise<ContinueConfig> {
  Object.keys(config.modelsByRole).forEach((key) => {
    config.modelsByRole[key as ModelRole].forEach((model) => {
      if (model.providerName === "continue-proxy") {
        (model as ContinueProxy).controlPlaneProxyInfo = info;
      }
    });
  });

  Object.keys(config.selectedModelByRole).forEach((key) => {
    const model = config.selectedModelByRole[key as ModelRole];
    if (model?.providerName === "continue-proxy") {
      (model as ContinueProxy).controlPlaneProxyInfo = info;
    }
  });

  config.models.forEach((model) => {
    if (model.providerName === "continue-proxy") {
      (model as ContinueProxy).controlPlaneProxyInfo = info;
    }
  });

  return config;
}

async function getWorkspaceConfigs(ide: IDE): Promise<ContinueRcJson[]> {
  const ideInfo = await ide.getIdeInfo();
  let workspaceConfigs: ContinueRcJson[] = [];

  try {
    workspaceConfigs = await ide.getWorkspaceConfigs();

    // Config is sent over the wire from JB so we need to parse it
    if (ideInfo.ideType.toLowerCase() === "jetbrains") {
      workspaceConfigs = (workspaceConfigs as any).map(JSON.parse);
    }
  } catch (e) {
    console.debug("Failed to load workspace configs: ", e);
  }

  return workspaceConfigs;
}
