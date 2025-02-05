import * as vscode from "vscode";

const os = require("node:os");

function charIsEscapedAtIndex(index: number, str: string): boolean {
  if (index === 0) {
    return false;
  }
  if (str[index - 1] !== "\\") {
    return false;
  }
  return !charIsEscapedAtIndex(index - 1, str);
}

export function convertSingleToDoubleQuoteJSON(json: string): string {
  const singleQuote = "'";
  const doubleQuote = '"';
  const isQuote = (char: string) =>
    char === doubleQuote || char === singleQuote;

  let newJson = "";
  let insideString = false;
  let enclosingQuoteType = doubleQuote;
  for (let i = 0; i < json.length; i++) {
    if (insideString) {
      if (json[i] === enclosingQuoteType && !charIsEscapedAtIndex(i, json)) {
        // Close string with a double quote
        insideString = false;
        newJson += doubleQuote;
      } else if (json[i] === singleQuote) {
        if (charIsEscapedAtIndex(i, json)) {
          // Unescape single quote
          newJson = newJson.slice(0, -1);
        }
        newJson += singleQuote;
      } else if (json[i] === doubleQuote) {
        if (!charIsEscapedAtIndex(i, json)) {
          // Escape double quote
          newJson += "\\";
        }
        newJson += doubleQuote;
      } else {
        newJson += json[i];
      }
    } else {
      if (isQuote(json[i])) {
        insideString = true;
        enclosingQuoteType = json[i];
        newJson += doubleQuote;
      } else {
        newJson += json[i];
      }
    }
  }

  return newJson;
}

export function debounced(delay: number, fn: (...args: any[]) => void) {
  let timerId: NodeJS.Timeout | null;
  return (...args: any[]) => {
    if (timerId) {
      clearTimeout(timerId);
    }
    timerId = setTimeout(() => {
      fn(...args);
      timerId = null;
    }, delay);
  };
}

type Platform = "mac" | "linux" | "windows" | "unknown";

export function getPlatform(): Platform {
  const platform = os.platform();
  if (platform === "darwin") {
    return "mac";
  } else if (platform === "linux") {
    return "linux";
  } else if (platform === "win32") {
    return "windows";
  } else {
    return "unknown";
  }
}

export function getAltOrOption() {
  if (getPlatform() === "mac") {
    return "⌥";
  } else {
    return "Alt";
  }
}

export function getMetaKeyLabel() {
  const platform = getPlatform();
  switch (platform) {
    case "mac":
      return "⌘";
    case "linux":
    case "windows":
      return "Ctrl";
    default:
      return "Ctrl";
  }
}

export function getMetaKeyName() {
  const platform = getPlatform();
  switch (platform) {
    case "mac":
      return "Cmd";
    case "linux":
    case "windows":
      return "Ctrl";
    default:
      return "Ctrl";
  }
}

export function getExtensionVersion(): string {
  const extension = vscode.extensions.getExtension("continue.continue");
  return extension?.packageJSON.version || "0.1.0";
}
