type LocalStorageTypes = {
  onboardingComplete: boolean;
  mainTextEntryCounter: number;
};

export function getLocalStorage<T extends keyof LocalStorageTypes>(
  key: T,
): LocalStorageTypes[T] | undefined {
  const value = localStorage.getItem(key);
  if (value === null) {
    return undefined;
  }
  return JSON.parse(value);
}

export function setLocalStorage<T extends keyof LocalStorageTypes>(
  key: T,
  value: LocalStorageTypes[T],
): void {
  localStorage.setItem(key, JSON.stringify(value));
}
