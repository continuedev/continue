import mergeJson from "core/util/merge";
import * as fs from "fs";
import { convertTheme } from "monaco-vscode-textmate-theme-converter/lib/cjs";
import * as path from "path";
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
  return JSON.parse(themeString || "{}");
}

export function getTheme() {
  let currentTheme = undefined;
  const colorTheme =
    vscode.workspace.getConfiguration("workbench").get<string>("colorTheme") ||
    "Default Dark Modern";

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
      const filename = builtinThemes[colorTheme] + ".json";
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
        : colorTheme.includes("Light")
        ? "vs"
        : "vs-dark"
    ) as any;

    return converted;
  } catch (e) {
    console.log("Error loading color theme: ", e);
  }
  return undefined;
}
