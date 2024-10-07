import _ from "lodash";
import { getLocalStorage, setLocalStorage } from "./localStorage";

type Platform = "mac" | "linux" | "windows" | "unknown";
export function getOverrideWsHost(): string {
  return getLocalStorage("overrideWsHost")
}

export function setOverrideWsHost(value: string): string {
  setLocalStorage("overrideWsHost", value)
  return getOverrideWsHost()
}

export function inSplitMode(): boolean {
  return getLocalStorage("inSplitMode") || false
}

export function setSplitMode(value: boolean): boolean {
  setLocalStorage("inSplitMode", value)
  console.log("inSplitMode", value)
  return inSplitMode()
}

export function getCurrentProject(): string {
  return getLocalStorage("currentProject")
}

export function setCurrentProject(project: string): string {
  setLocalStorage("currentProject", project)
  return getCurrentProject()
}

export function getServerToken(): string {
  return getLocalStorage("serverToken")
}

export function setServerToken(token: string): string {
  setLocalStorage("serverToken", token)
  return getServerToken()
}

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

export function setJetBrains() {
  return setLocalStorage("ide", "jetbrains");
}

export function isWebEnvironment(): boolean {
  return (
    typeof window !== "undefined" &&
    window.navigator &&
    window.navigator.userAgent.indexOf("Electron") === -1
  );
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

/**
 * Updates the values of an object's properties based on the specified paths.
 *
 * This function creates a deep clone of the provided object and updates its properties
 * based on the given path-to-value mappings. If a value in the mapping is a function,
 * it will be used to determine the new value for the property. Otherwise, the value itself
 * will be set for the property.
 *
 * @param {Object} old - The original object to be cloned and updated.
 * @param {Object} pathToValue - An object where the keys represent the paths to the properties
 *                               to be updated and the values represent the new values or functions
 *                               to determine the new values.
 * @returns {Object} A new object with the updated values.
 */
export function updatedObj(old: any, pathToValue: { [key: string]: any }) {
  const newObject = _.cloneDeep(old);

  for (const key in pathToValue) {
    if (typeof pathToValue[key] === "function") {
      _.updateWith(newObject, key, pathToValue[key]);
    } else {
      _.updateWith(newObject, key, (__) => pathToValue[key]);
    }
  }

  return newObject;
}
