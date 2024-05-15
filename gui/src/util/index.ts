import { getLocalStorage } from "./localStorage";

type Platform = "mac" | "linux" | "windows" | "unknown";

export function getPlatform(): Platform {
  const platform = window.navigator.platform.toUpperCase();
  if (platform.indexOf("MAC") >= 0) {
    return "mac";
  } else if (platform.indexOf("LINUX") >= 0) {
    return "linux";
  } else if (platform.indexOf("WIN") >= 0) {
    return "windows";
  } else {
    return "unknown";
  }
}

export function isMetaEquivalentKeyPressed(event: {
  metaKey: boolean;
  ctrlKey: boolean;
}): boolean {
  const platform = getPlatform();
  switch (platform) {
    case "mac":
      return event.metaKey;
    case "linux":
    case "windows":
      return event.ctrlKey;
    default:
      return event.metaKey;
  }
}

export function getMetaKeyLabel(): string {
  const platform = getPlatform();
  switch (platform) {
    case "mac":
      return "⌘";
    case "linux":
    case "windows":
      return "^";
    default:
      return "^";
  }
}

export function getAltKeyLabel(): string {
  const platform = getPlatform();
  switch (platform) {
    case "mac":
      return "⌥";
    default:
      return "Alt";
  }
}

export function getFontSize(): number {
  return getLocalStorage("fontSize") ?? (isJetBrains() ? 15 : 14);
}
export function isJetBrains() {
  return getLocalStorage("ide") === "jetbrains";
}

export function isPrerelease() {
  const extensionVersion = getLocalStorage("extensionVersion");
  if (!extensionVersion) {
    console.warn(
      `Could not find extension version in local storage, assuming it's a prerelease`,
    );
    return true;
  }
  const minor = parseInt(extensionVersion.split(".")[1], 10);
  if (minor % 2 !== 0) {
    return true;
  }
  return false;
}
