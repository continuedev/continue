import { getContinueRcPath, getTsConfigPath } from "core/util/paths";
import * as vscode from "vscode";

import { VsCodeExtension } from "../extension/VsCodeExtension";
import { removeStaleYamlSchemaEntries } from "../lang-server/yamlSchemas";
import { isUnsupportedPlatform } from "../util/util";
import { migrateContinueSettings } from "../util/migrateSettings";

import { GlobalContext } from "core/util/GlobalContext";
import { VsCodeContinueApi } from "./api";
import setupInlineTips from "./InlineTipManager";

export async function activateExtension(context: vscode.ExtensionContext) {
  // Before anything reads a setting: continue.* became continuous.* in 2.4.2
  try {
    await migrateContinueSettings(context);
  } catch (error) {
    console.warn("Could not copy the continue.* settings", error);
  }

  const platformCheck = isUnsupportedPlatform();
  const globalContext = new GlobalContext();
  const hasShownUnsupportedPlatformWarning = globalContext.get(
    "hasShownUnsupportedPlatformWarning",
  );

  if (platformCheck.isUnsupported && !hasShownUnsupportedPlatformWarning) {
    const platformTarget = "windows-arm64";

    globalContext.update("hasShownUnsupportedPlatformWarning", true);
    void vscode.window.showInformationMessage(
      `Continuous detected that you are using ${platformTarget}. Due to native dependencies, Continuous may not be able to start`,
    );
  }

  // Add necessary files
  getTsConfigPath();
  getContinueRcPath();

  // Register commands and providers
  setupInlineTips(context);

  const vscodeExtension = new VsCodeExtension(context);

  // Load Continuous configuration
  if (!context.globalState.get("hasBeenInstalled")) {
    void context.globalState.update("hasBeenInstalled", true);
  }

  // The YAML schemas are declared in package.json (yamlValidation), one per
  // file. Earlier versions wrote the config schema into the user's
  // yaml.schemas setting instead, once per installed version, and never
  // removed it; take those entries out.
  try {
    await removeStaleYamlSchemaEntries();
  } catch (error) {
    console.warn("Could not clean up yaml.schemas", error);
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
