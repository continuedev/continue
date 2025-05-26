import { getContinueRcPath, getTsConfigPath } from "core/util/paths";
import { Telemetry } from "core/util/posthog";
import * as vscode from "vscode";

import * as path from "path";
import { VsCodeExtension } from "../extension/VsCodeExtension";
import registerQuickFixProvider from "../lang-server/codeActions";
import { getExtensionVersion } from "../util/util";

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
  const yamlConfig = vscode.workspace.getConfiguration("yaml");
  const existingSchemas = yamlConfig.get("schemas") || {};

  const oldContinueSchemaKeys = Object.entries(existingSchemas)
    .filter(
      ([_, value]) =>
        Array.isArray(value) && value.includes(".continue/**/*.yaml"),
    )
    .map(([key]) => key);

  for (const oldKey of oldContinueSchemaKeys) {
    await yamlConfig.update(
      `schemas.${oldKey}`,
      undefined,
      vscode.ConfigurationTarget.Global,
    );
  }

  const newPath = path.join(
    context.extension.extensionUri.fsPath,
    "config-yaml-schema.json",
  );
  await yamlConfig.update(
    `schemas.${newPath}`,
    [".continue/**/*.yaml"],
    vscode.ConfigurationTarget.Global,
  );

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
