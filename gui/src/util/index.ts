import { MessageModes, ModelDescription } from "core";
import { ProfileDescription } from "core/config/ProfileLifecycleManager";
import {
  DEFAULT_AGENT_SYSTEM_MESSAGE,
  DEFAULT_CHAT_SYSTEM_MESSAGE,
} from "core/llm/constructMessages";
import _ from "lodash";
import { KeyboardEvent as ReactKeyboardEvent } from "react";
import { getLocalStorage } from "./localStorage";

export type Platform = "mac" | "linux" | "windows" | "unknown";

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

export function isMetaEquivalentKeyPressed({
  metaKey,
  ctrlKey,
}: KeyboardEvent | ReactKeyboardEvent): boolean {
  const platform = getPlatform();
  switch (platform) {
    case "mac":
      return metaKey;
    case "linux":
    case "windows":
      return ctrlKey;
    default:
      return metaKey;
  }
}

export function getMetaKeyLabel(): string {
  return getPlatform() === "mac" ? "⌘" : "Ctrl";
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

export function fontSize(n: number): string {
  return `${getFontSize() + n}px`;
}

export function isJetBrains() {
  return getLocalStorage("ide") === "jetbrains";
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

export function isLocalProfile(profile: ProfileDescription): boolean {
  return profile.profileType === "local";
}

/**
 * Get the base system message for the agent or chat mode from the model description.
 */
export function getBaseSystemMessage(
  modelDetails: ModelDescription | null,
  mode: MessageModes,
) {
  let baseChatOrAgentSystemMessage: string | undefined;
  if (mode === "agent") {
    baseChatOrAgentSystemMessage =
      modelDetails?.baseAgentSystemMessage ?? DEFAULT_AGENT_SYSTEM_MESSAGE;
  } else {
    baseChatOrAgentSystemMessage =
      modelDetails?.baseChatSystemMessage ?? DEFAULT_CHAT_SYSTEM_MESSAGE;
  }
  return baseChatOrAgentSystemMessage;
}
