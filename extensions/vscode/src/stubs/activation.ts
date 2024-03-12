import { getUserToken } from "./auth";
import { RemoteConfigSync } from "./remoteConfig";

export async function setupRemoteConfigSync(reloadConfig: () => void) {
  getUserToken().then((token) => {
    try {
      const configSync = new RemoteConfigSync(reloadConfig, token);
      configSync.setup();
    } catch (e) {
      console.warn(`Failed to sync remote config: ${e}`);
    }
  });
}
