import * as path from "path";

import { getContinueRcPath, getTsConfigPath } from "core/util/paths";
import { Telemetry } from "core/util/posthog";
import * as vscode from "vscode";

import { VsCodeExtension } from "../extension/VsCodeExtension";
import { registerModelUpdater } from "../granite/ollama/modelUpdater";
import { replaceCopilotWithGraniteCode } from "../granite/utils/compatibilityUtils";
import { isGraniteOnboardingComplete } from "../granite/utils/extensionUtils";
import registerQuickFixProvider from "../lang-server/codeActions";
import { getExtensionVersion } from "../util/util";

import { GRANITE_INITIAL_ACTIVATION_COMPLETED_KEY } from "core/granite/commons/constants";
import { VsCodeContinueApi } from "./api";
import setupInlineTips from "./InlineTipManager";

export async function activateExtension(context: vscode.ExtensionContext) {
  // Add necessary files
  getTsConfigPath();
  getContinueRcPath();

  // Register commands and providers
  registerQuickFixProvider();
  setupInlineTips(context);

  const vscodeExtension = new VsCodeExtension(context);

  // Load Continue configuration
  if (!context.globalState.get("hasBeenInstalled")) {
    context.globalState.update("hasBeenInstalled", true);
    Telemetry.capture(
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

  const existingSchemas = yamlConfig.get("schemas") || {};
  const newSchemas = Object.entries(existingSchemas).filter(
    ([_, value]) => Array.isArray(value) && value.includes(yamlMatcher), // remove old ones
  );

  const newPath = path.join(
    context.extension.extensionUri.fsPath,
    "config-yaml-schema.json",
  );
  newSchemas.push([newPath, [yamlMatcher]]);

  try {
    await yamlConfig.update(
      "schemas",
      Object.fromEntries(newSchemas),
      vscode.ConfigurationTarget.Global,
    );
  } catch (error) {
    console.error(
      "Failed to register Continue config.yaml schema, most likely, YAML extension is not installed",
      error,
    );
  }

  const api = new VsCodeContinueApi(vscodeExtension);
  const graniteOnboardingComplete = isGraniteOnboardingComplete(context);
  await vscode.commands.executeCommand(
    "setContext",
    "granite.initialized",
    graniteOnboardingComplete,
  );

  const initialActivationCompleted = context.globalState.get<boolean>(
    GRANITE_INITIAL_ACTIVATION_COMPLETED_KEY,
    false,
  );
  if (!initialActivationCompleted) {
    if (!graniteOnboardingComplete) {
      replaceCopilotWithGraniteCode();
      await vscode.commands.executeCommand("granite.setup");
    }
    await context.globalState.update(
      GRANITE_INITIAL_ACTIVATION_COMPLETED_KEY,
      true,
    );
  }

  registerModelUpdater(context);

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
