import { getContinueRcPath, getTsConfigPath } from "core/util/paths";
import { Telemetry } from "core/util/posthog";
import * as vscode from "vscode";

import { VsCodeExtension } from "../extension/VsCodeExtension";
import { getExtensionVersion, isUnsupportedPlatform } from "../util/util";

import { GlobalContext } from "core/util/GlobalContext";
import { VsCodeContinueApi } from "./api";
import setupInlineTips from "./InlineTipManager";

export async function activateExtension(context: vscode.ExtensionContext) {
  const platformCheck = isUnsupportedPlatform();
  const globalContext = new GlobalContext();
  const hasShownUnsupportedPlatformWarning = globalContext.get(
    "hasShownUnsupportedPlatformWarning",
  );

  if (platformCheck.isUnsupported && !hasShownUnsupportedPlatformWarning) {
    const platformTarget = "windows-arm64";

    globalContext.update("hasShownUnsupportedPlatformWarning", true);
    void vscode.window.showInformationMessage(
      `Continue detected that you are using ${platformTarget}. Due to native dependencies, Continue may not be able to start`,
    );

    void Telemetry.capture(
      "unsupported_platform_activation_attempt",
      {
        platform: platformTarget,
        extensionVersion: getExtensionVersion(),
        reason: platformCheck.reason,
      },
      true,
    );
  }

  // Add necessary files
  getTsConfigPath();
  getContinueRcPath();

  // Register commands and providers
  setupInlineTips(context);

  const vscodeExtension = new VsCodeExtension(context);

  // Load Continue configuration
  if (!context.globalState.get("hasBeenInstalled")) {
    void context.globalState.update("hasBeenInstalled", true);
    void Telemetry.capture(
      "install",
      {
        extensionVersion: getExtensionVersion(),
      },
      true,
    );
  }

  // Register config.yaml schema by removing old entries and adding new one (uri.fsPath changes with each version)
  const yamlMatcher = ".continue/**/*.yaml";
  const yamlConfig = vscode.workspace.getConfiguration("yaml");
  const yamlSchemas = yamlConfig.get<object>("schemas", {});

  const newPath = vscode.Uri.joinPath(
    context.extension.extensionUri,
    "config-yaml-schema.json",
  ).toString();

  try {
    await yamlConfig.update(
      "schemas",
      {
        ...yamlSchemas,
        [newPath]: [yamlMatcher],
      },
      vscode.ConfigurationTarget.Global,
    );
  } catch (error) {
    console.error(
      "Failed to register Continue config.yaml schema, most likely, YAML extension is not installed",
      error,
    );
  }

  const api = new VsCodeContinueApi(vscodeExtension);
  const continuePublicApi = {
    registerCustomContextProvider: api.registerCustomContextProvider.bind(api),
  };

  // 'export' public api-surface
  // or entire extension for testing
  return process.env.NODE_ENV === "test"
    ? {
        ...continuePublicApi,
        extension: vscodeExtension,
      }
    : continuePublicApi;
}
