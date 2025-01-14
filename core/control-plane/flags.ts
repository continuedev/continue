import { readUsePlatform, usePlatformPathExists } from "../util/paths";

export function usePlatform(): boolean {
  return usePlatformPathExists();
}

export function getEnvFromUsePlatformFile(): string | undefined {
  const contents = readUsePlatform();
  if (contents && contents.trim().length > 0) {
    return contents.trim();
  }
  return undefined;
}
