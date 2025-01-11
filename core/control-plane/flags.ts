import { usePlatformPathExists } from "../util/paths";

export function usePlatform(): boolean {
  return usePlatformPathExists();
}
