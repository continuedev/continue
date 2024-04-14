type LocalStorageTypes = {
  onboardingComplete: boolean;
  mainTextEntryCounter: number;
  ide: "vscode" | "jetbrains";
  ftc: number;
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
  } catch (e) {
    return undefined;
  }
}

export function setLocalStorage<T extends keyof LocalStorageTypes>(
  key: T,
  value: LocalStorageTypes[T],
): void {
  localStorage.setItem(key, JSON.stringify(value));
}
