import { JSONContent } from "@tiptap/react";
import { IndexingProgressUpdate } from "core";

type LocalStorageTypes = {
  onboardingComplete: boolean;
  mainTextEntryCounter: number;
  lastSessionId: string | undefined;
  inputHistory: JSONContent[];
  extensionVersion: string;
  indexingState: IndexingProgressUpdate;
  fontSize: number;
};

export function getLocalStorage<T extends keyof LocalStorageTypes>(
  key: T,
): LocalStorageTypes[T] | undefined {
  const value = localStorage.getItem(key);
  if (value === null) {
    return undefined;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    console.error(
      `Error parsing ${key} from local storage. Value was ${value}\n\n`,
      error,
    );
    return undefined;
  }
}

export function setLocalStorage<T extends keyof LocalStorageTypes>(
  key: T,
  value: LocalStorageTypes[T],
): void {
  localStorage.setItem(key, JSON.stringify(value));
}
