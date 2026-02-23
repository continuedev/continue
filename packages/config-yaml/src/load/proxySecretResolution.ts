import { PlatformSecretStore, SecretStore } from "../interfaces/index.js";
import {
  SecretLocation,
  encodeSecretLocation,
} from "../interfaces/SecretResult.js";

export async function resolveSecretLocationInProxy(
  secretLocaton: SecretLocation,
  platformSecretStore: PlatformSecretStore,
  environmentSecretStore?: SecretStore,
): Promise<string> {
  // 1. Check environment variables (if supported)
  if (environmentSecretStore) {
    const envSecretValue = await environmentSecretStore.get(
      secretLocaton.secretName,
    );
    if (envSecretValue) {
      return envSecretValue;
    }
  }

  // 2. Get from secret location
  const platformSecret =
    await platformSecretStore.getSecretFromSecretLocation(secretLocaton);
  if (platformSecret) {
    return platformSecret;
  }

  throw new Error(
    `Could not resolve secret with location ${encodeSecretLocation(secretLocaton)}`,
  );
}
