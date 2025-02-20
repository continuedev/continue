import { SecretLocation, SecretResult, SecretType } from "./SecretResult.js";
import { FQSN, FullSlug, PackageSlug, packageSlugsEqual } from "./slugs.js";

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

export function getLocationsToLook(
  assistantSlug: PackageSlug,
  blockSlug: PackageSlug | undefined,
  currentUserSlug: string,
  secretName: string,
): SecretLocation[] {
  const locationsToLook: SecretLocation[] = [
    // Block
    ...(blockSlug
      ? [
          {
            secretType: SecretType.Package as const,
            packageSlug: blockSlug,
            secretName,
          },
        ]
      : []),
    // Assistant
    {
      secretType: SecretType.Package as const,
      packageSlug: assistantSlug,
      secretName,
    },
    // Organization that owns assistant (org secrets can only be used in assistants owned by that org)
    {
      secretType: SecretType.Organization as const,
      orgSlug: assistantSlug.ownerSlug,
      secretName,
    },
    // Then user
    {
      secretType: SecretType.User as const,
      userSlug: currentUserSlug,
      secretName,
    },
  ];
  return locationsToLook;
}

export async function listAvailableSecrets(
  userSecretNames: string[],
  orgSecretNames: string[],
  assistantSecretNames: string[],
  blockSecretNames: string[],
  assistantSlug: PackageSlug,
  blockSlug: PackageSlug | undefined,
  currentUserSlug: string,
) {
  // Create a set of all secret names
  const allSecretNames = new Set([
    ...userSecretNames,
    ...orgSecretNames,
    ...assistantSecretNames,
    ...blockSecretNames,
  ]);

  // Use the resolution order to get a single SecretLocation for each secret name
  const secretLocations: SecretLocation[] = [];
  for (const secretName of allSecretNames) {
    // Get the order of places to look
    const locationsToLook = getLocationsToLook(
      assistantSlug,
      blockSlug,
      currentUserSlug,
      secretName,
    );

    // Go through the locations one by one
    for (const secretLocation of locationsToLook) {
      // "Looking in a location" in this case means looking through one of the lists of secret names
      // First we get that list of secret names
      let secretNamesList: string[] = [];
      switch (secretLocation.secretType) {
        case SecretType.User:
          secretNamesList = userSecretNames;
          break;
        case SecretType.Organization:
          secretNamesList = orgSecretNames;
          break;
        case SecretType.Package:
          if (packageSlugsEqual(secretLocation.packageSlug, assistantSlug)) {
            secretNamesList = assistantSecretNames;
          } else if (
            blockSlug &&
            packageSlugsEqual(secretLocation.packageSlug, blockSlug)
          ) {
            secretNamesList = blockSecretNames;
          }
          break;
      }

      // Then we look through that list for the matching secret name
      if (secretNamesList) {
        const matchingSecretName = secretNamesList.find(
          (secretName) => secretName === secretLocation.secretName,
        );
        if (matchingSecretName) {
          // If we find a matching secret name, we add the location to the list
          secretLocations.push(secretLocation);
          break;
        }
      }
    }
  }

  return secretLocations;
}

export async function resolveFQSN(
  currentUserSlug: string,
  fqsn: FQSN,
  platformSecretStore: PlatformSecretStore,
): Promise<SecretResult> {
  // First create the list of secret locations to try in order
  const assistantSlug = fqsn.packageSlugs[0];
  const blockSlug = fqsn.packageSlugs[1];
  const locationsToLook = getLocationsToLook(
    assistantSlug,
    blockSlug,
    currentUserSlug,
    fqsn.secretName,
  );

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
