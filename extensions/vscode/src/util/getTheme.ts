import * as fs from "node:fs";
import * as path from "node:path";

import mergeJson from "core/util/merge";
import { convertTheme } from "monaco-vscode-textmate-theme-converter/lib/cjs";
import * as vscode from "vscode";

import { getExtensionUri } from "./vscode";

const builtinThemes: any = {
  "Default Dark Modern": "dark_modern",
  "Dark+": "dark_plus",
  "Default Dark+": "dark_plus",
  "Dark (Visual Studio)": "dark_vs",
  "Visual Studio Dark": "dark_vs",
  "Dark High Contrast": "hc_black",
  "Default High Contrast": "hc_black",
  "Light High Contrast": "hc_light",
  "Default High Contrast Light": "hc_light",
  "Default Light Modern": "light_modern",
  "Light+": "light_plus",
  "Default Light+": "light_plus",
  "Light (Visual Studio)": "light_vs",
  "Visual Studio Light": "light_vs",
};

function parseThemeString(themeString: string | undefined): any {
  themeString = themeString
    ?.split("\n")
    .filter((line) => {
      return !line.trim().startsWith("//");
    })
    .join("\n");
  return JSON.parse(themeString ?? "{}");
}

export function getTheme() {
  let currentTheme = undefined;
  // Get color theme from settings
  // use user settings if available
  // otherwise use default
  let colorTheme: string | undefined = undefined;

  // Get color theme from settings
  const workbenchConfig = vscode.workspace.getConfiguration();
  const autoDetectColorScheme = workbenchConfig.get<boolean>(
    "window.autoDetectColorScheme",
  );
  const autoDetectHighContrast = workbenchConfig.get<boolean>(
    "window.autoDetectHighContrast",
  );
  const activeColorTheme = vscode.window.activeColorTheme.kind;

  if (autoDetectHighContrast || autoDetectColorScheme) {
    switch (activeColorTheme) {
      case vscode.ColorThemeKind.Dark:
        colorTheme = workbenchConfig.get<string>(
          "workbench.preferredDarkColorTheme",
        );
        break;
      case vscode.ColorThemeKind.Light:
        colorTheme = workbenchConfig.get<string>(
          "workbench.preferredLightColorTheme",
        );
        break;
      case vscode.ColorThemeKind.HighContrast:
        colorTheme = workbenchConfig.get<string>(
          "workbench.preferredHighContrastColorTheme",
        );
        break;
      case vscode.ColorThemeKind.HighContrastLight:
        colorTheme = workbenchConfig.get<string>(
          "workbench.preferredHighContrastLightColorTheme",
        );
        break;
      default:
        console.log("unknown color theme kind", activeColorTheme);
        colorTheme = workbenchConfig.get<string>("workbench.colorTheme");
        break;
    }
  }

  if (!colorTheme) {
    colorTheme =
      workbenchConfig.get<string>("workbench.colorTheme") ??
      "Default Dark Modern";
  }

  try {
    // Pass color theme to webview for syntax highlighting
    for (let i = vscode.extensions.all.length - 1; i >= 0; i--) {
      if (currentTheme) {
        break;
      }
      const extension = vscode.extensions.all[i];
      if (extension.packageJSON?.contributes?.themes?.length > 0) {
        for (const theme of extension.packageJSON.contributes.themes) {
          if (theme.label === colorTheme) {
            const themePath = path.join(extension.extensionPath, theme.path);
            currentTheme = fs.readFileSync(themePath).toString();
            break;
          }
        }
      }
    }

    if (currentTheme === undefined && builtinThemes[colorTheme]) {
      const filename = `${builtinThemes[colorTheme]}.json`;
      currentTheme = fs
        .readFileSync(
          path.join(getExtensionUri().fsPath, "builtin-themes", filename),
        )
        .toString();
    }

    // Strip comments from theme
    let parsed = parseThemeString(currentTheme);

    if (parsed.include) {
      const includeThemeString = fs
        .readFileSync(
          path.join(getExtensionUri().fsPath, "builtin-themes", parsed.include),
        )
        .toString();
      const includeTheme = parseThemeString(includeThemeString);
      parsed = mergeJson(parsed, includeTheme);
    }

    const converted = convertTheme(parsed);

    converted.base = (
      ["vs", "hc-black"].includes(converted.base)
        ? converted.base
        : activeColorTheme === vscode.ColorThemeKind.Light ||
            activeColorTheme === vscode.ColorThemeKind.HighContrastLight
          ? "vs"
          : "vs-dark"
    ) as any;

    return converted;
  } catch (e) {
    console.log("Error loading color theme: ", e);
  }
  return undefined;
}
