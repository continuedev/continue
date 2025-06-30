import * as fs from "node:fs";
import * as path from "node:path";

import mergeJson from "core/util/merge";
import { convertTheme } from "monaco-vscode-textmate-theme-converter/lib/cjs";
import * as vscode from "vscode";

/**
 * Strip comments from theme
 */

function stripInLineComment(line: string): string {
  let inString = false;
  let pCh = "";

  for (let i = 0; i < line.length - 1; i++) {
    const ch = line[i];
    const nCh = line[i + 1];

    // If we're not in a string and we see '//' this is a comment.
    if (!inString && ch === "/" && nCh === "/") {
      // Stop processing this line from here.
      return line.substring(0, i);
    }

    // Toggle inString state if we see a double quote not escaped by a backslash.
    if (ch === '"' && pCh !== "\\") {
      inString = !inString;
    }

    pCh = ch;
  }

  return line;
}

function parseThemeString(themeString: string | undefined): any {
  themeString = themeString
    ?.split("\n")
    .filter((line) => {
      return !line.trim().startsWith("//");
    })
    .map(stripInLineComment)
    .join("\n");
  return JSON.parse(themeString ?? "{}");
}

export function getThemeString(): string {
  const workbenchConfig = vscode.workspace.getConfiguration();
  const themeString =
    workbenchConfig.get<string>("workbench.colorTheme") ??
    "Default Dark Modern";
  return themeString;
}

export function getTheme() {
  let currentTheme: string | undefined = undefined;
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

  // prettier-ignore
  switch (true) {
    case autoDetectColorScheme && vscode.ColorThemeKind.Dark === activeColorTheme:
      colorTheme = workbenchConfig.get<string>(
        "workbench.preferredDarkColorTheme",
      );
      break;
    case autoDetectColorScheme && vscode.ColorThemeKind.Light === activeColorTheme:
      colorTheme = workbenchConfig.get<string>(
        "workbench.preferredLightColorTheme",
      );
      break;
    case autoDetectHighContrast && vscode.ColorThemeKind.HighContrast === activeColorTheme:
      colorTheme = workbenchConfig.get<string>(
        "workbench.preferredHighContrastColorTheme",
      );
      break;
    case autoDetectHighContrast && vscode.ColorThemeKind.HighContrastLight === activeColorTheme:
      colorTheme = workbenchConfig.get<string>(
        "workbench.preferredHighContrastLightColorTheme",
      );
      break;
    default:
      colorTheme =
        workbenchConfig.get<string>("workbench.colorTheme") ??
        "Default Dark Modern";
      break;
  }

  let parsed;
  try {
    // Pass color theme to webview for syntax highlighting
    for (let i = vscode.extensions.all.length - 1; i >= 0; i--) {
      const extension = vscode.extensions.all[i];
      if (extension.packageJSON?.contributes?.themes?.length > 0) {
        if (currentTheme) {
          break;
        }
        for (const theme of extension.packageJSON.contributes.themes) {
          if (theme.id === colorTheme || theme.label === colorTheme) {
            const themePath = path.join(extension.extensionPath, theme.path);
            currentTheme = fs.readFileSync(themePath).toString();

            parsed = parseThemeString(currentTheme);

            // Handle nested includes
            let currentParsedTheme = parsed;
            let currentThemePath = themePath;
            let mergedTheme = currentParsedTheme;

            while (currentParsedTheme.include) {
              const themeDir = path.dirname(currentThemePath);
              const includeThemePath = path.join(
                themeDir,
                currentParsedTheme.include,
              );

              if (fs.existsSync(includeThemePath)) {
                const includeThemeString = fs
                  .readFileSync(includeThemePath)
                  .toString();

                const includeTheme = parseThemeString(includeThemeString);
                // Merge with base theme taking precedence, then overlay current customizations
                mergedTheme = mergeJson(
                  mergeJson({}, includeTheme), // Start with base
                  mergedTheme, // Overlay with customizations
                );

                // Update for next iteration - only update path and parsed theme for include checking
                currentThemePath = includeThemePath;
                currentParsedTheme = includeTheme;
              } else {
                console.log(
                  `include theme not found for ${currentTheme} looked for ${currentParsedTheme.include} in ${themeDir}`,
                  includeThemePath,
                );
                break;
              }
            }

            parsed = mergedTheme;
            break;
          }
        }
      }
    }

    if (!currentTheme) {
      console.warn(`did not find any theme files for theme ${colorTheme}`);
      return undefined;
    }

    let convertedTheme: { base: string; include?: string } & Record<
      string,
      any
    > = convertTheme(parsed);

    convertedTheme.base = (
      ["vs", "hc-black"].includes(convertedTheme.base)
        ? convertedTheme.base
        : activeColorTheme === vscode.ColorThemeKind.Light ||
            activeColorTheme === vscode.ColorThemeKind.HighContrastLight
          ? "vs"
          : "vs-dark"
    ) as any;

    return convertedTheme;
  } catch (e) {
    console.log("Error loading color theme: ", e);
  }
  return undefined;
}
