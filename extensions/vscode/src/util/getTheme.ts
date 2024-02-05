import * as fs from "fs";
import { convertTheme } from "monaco-vscode-textmate-theme-converter/lib/cjs";
import * as path from "path";
import * as vscode from "vscode";

export function getTheme() {
  let currentTheme = undefined;

  try {
    // Pass color theme to webview for syntax highlighting
    const colorTheme = vscode.workspace
      .getConfiguration("workbench")
      .get("colorTheme");

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

    // Strip comments from theme
    currentTheme = currentTheme
      ?.split("\n")
      .filter((line) => {
        return !line.trim().startsWith("//");
      })
      .join("\n");

    const converted = convertTheme(JSON.parse(currentTheme || "{}"));

    return converted;
  } catch (e) {
    console.log("Error adding .continueignore file icon: ", e);
  }
  return undefined;
}
