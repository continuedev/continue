import { SecretLocation, SecretResult, SecretType } from "./SecretResult.js";
import { FQSN, FullSlug } from "./slugs.js";

/**
 * A registry stores the content of packages
 */
export interface Registry {
  getContent(fullSlug: FullSlug): Promise<string>;
}
export type SecretNamesMap = Map<FQSN, string>;

/**
 * A secret store stores secrets
 */
export interface SecretStore {
  get(secretName: string): Promise<string | undefined>;
  set(secretName: string, secretValue: string): Promise<void>;
}

export interface PlatformClient {
  resolveFQSNs(fqsns: FQSN[]): Promise<(SecretResult | undefined)[]>;
}

export interface PlatformSecretStore {
  getSecretFromSecretLocation(
    secretLocation: SecretLocation,
  ): Promise<string | undefined>;
}

export async function resolveFQSN(
  currentUserSlug: string,
  fqsn: FQSN,
  platformSecretStore: PlatformSecretStore,
): Promise<SecretResult> {
  // First create the list of secret locations to try in order
  const reversedSlugs = [...fqsn.packageSlugs].reverse();

  const locationsToLook: SecretLocation[] = [
    // Organization first
    ...reversedSlugs.map((slug) => ({
      secretType: SecretType.Organization as const,
      orgSlug: slug.ownerSlug,
      secretName: fqsn.secretName,
    })),
    // Then packages
    ...reversedSlugs.map((slug) => ({
      secretType: SecretType.Package as const,
      packageSlug: slug,
      secretName: fqsn.secretName,
    })),
    // Then user
    {
      secretType: SecretType.User as const,
      userSlug: currentUserSlug,
      secretName: fqsn.secretName,
    },
  ];

  // Then try to get the secret from each location
  for (const secretLocation of locationsToLook) {
    const secret =
      await platformSecretStore.getSecretFromSecretLocation(secretLocation);
    if (secret) {
      if (secretLocation.secretType === SecretType.User) {
        // Only user secret values get sent back to client
        return {
          found: true,
          fqsn,
          secretLocation,
          value: secret,
        };
      } else if (secretLocation.secretType !== SecretType.NotFound) {
        return {
          found: true,
          fqsn,
          secretLocation,
        };
      }
    }
  }

  return {
    found: false,
    secretLocation: {
      secretName: fqsn.secretName,
      secretType: SecretType.NotFound,
    },
    fqsn,
  };
}
