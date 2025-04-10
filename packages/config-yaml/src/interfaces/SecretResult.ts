import { FQSN, PackageSlug, encodePackageSlug } from "./slugs.js";

export enum SecretType {
  User = "user",
  Package = "package",
  Organization = "organization",
  NotFound = "not_found",
  ModelsAddOn = "models_add_on",
  FreeTrial = "free_trial",
  LocalEnv = "local_env",
}

export interface OrgSecretLocation {
  secretType: SecretType.Organization;
  orgSlug: string;
  secretName: string;
}

export interface PackageSecretLocation {
  secretType: SecretType.Package;
  packageSlug: PackageSlug;
  secretName: string;
}

export interface UserSecretLocation {
  secretType: SecretType.User;
  userSlug: string;
  secretName: string;
}

export interface ModelsAddOnSecretLocation {
  secretType: SecretType.ModelsAddOn;
  blockSlug: PackageSlug;
  secretName: string;
}

export interface FreeTrialSecretLocation {
  secretType: SecretType.FreeTrial;
  blockSlug: PackageSlug;
  secretName: string;
}

export interface LocalEnvSecretLocation {
  secretType: SecretType.LocalEnv;
  secretName: string;
}

/**
 * If not found in user/package/org secrets, then there's a chance it's in
 * - the on-prem proxy
 * - models add-on
 * - free trial
 */
export interface NotFoundSecretLocation {
  secretType: SecretType.NotFound;
  secretName: string;
}

export type SecretLocation =
  | OrgSecretLocation
  | PackageSecretLocation
  | UserSecretLocation
  | NotFoundSecretLocation
  | ModelsAddOnSecretLocation
  | FreeTrialSecretLocation
  | LocalEnvSecretLocation;

export function encodeSecretLocation(secretLocation: SecretLocation): string {
  if (secretLocation.secretType === SecretType.Organization) {
    return `${SecretType.Organization}:${secretLocation.orgSlug}/${secretLocation.secretName}`;
  } else if (secretLocation.secretType === SecretType.User) {
    return `${SecretType.User}:${secretLocation.userSlug}/${secretLocation.secretName}`;
  } else if (secretLocation.secretType === SecretType.Package) {
    return `${SecretType.Package}:${encodePackageSlug(secretLocation.packageSlug)}/${secretLocation.secretName}`;
  } else if (secretLocation.secretType === SecretType.NotFound) {
    return `${SecretType.NotFound}:${secretLocation.secretName}`;
  } else if (secretLocation.secretType === SecretType.ModelsAddOn) {
    return `${SecretType.ModelsAddOn}:${encodePackageSlug(secretLocation.blockSlug)}/${secretLocation.secretName}`;
  } else if (secretLocation.secretType === SecretType.FreeTrial) {
    return `${SecretType.FreeTrial}:${encodePackageSlug(secretLocation.blockSlug)}/${secretLocation.secretName}`;
  } else if (secretLocation.secretType === SecretType.LocalEnv) {
    return `${SecretType.LocalEnv}:${secretLocation.secretName}`;
  } else {
    throw new Error(`Invalid secret type: ${secretLocation}`);
  }
}

export function decodeSecretLocation(secretLocation: string): SecretLocation {
  const [secretType, rest] = secretLocation.split(":");
  const parts = rest.split("/");
  const secretName = parts[parts.length - 1];

  switch (secretType) {
    case SecretType.Organization:
      return {
        secretType: SecretType.Organization,
        orgSlug: parts[0],
        secretName,
      };
    case SecretType.User:
      return {
        secretType: SecretType.User,
        userSlug: parts[0],
        secretName,
      };
    case SecretType.Package:
      return {
        secretType: SecretType.Package,
        packageSlug: { ownerSlug: parts[0], packageSlug: parts[1] },
        secretName,
      };
    case SecretType.NotFound:
      return {
        secretType: SecretType.NotFound,
        secretName,
      };
    case SecretType.ModelsAddOn:
      return {
        secretType: SecretType.ModelsAddOn,
        secretName,
        blockSlug: {
          ownerSlug: parts[0],
          packageSlug: parts[1],
        },
      };
    case SecretType.FreeTrial:
      return {
        secretType: SecretType.FreeTrial,
        secretName,
        blockSlug: {
          ownerSlug: parts[0],
          packageSlug: parts[1],
        },
      };
    case SecretType.LocalEnv:
      return {
        secretType: SecretType.LocalEnv,
        secretName,
      };
    default:
      throw new Error(`Invalid secret type: ${secretType}`);
  }
}

export interface NotFoundSecretResult {
  found: false;
  secretLocation: NotFoundSecretLocation;
  fqsn: FQSN;
}

export interface FoundSecretResult {
  found: true;
  secretLocation:
    | OrgSecretLocation
    | PackageSecretLocation
    | ModelsAddOnSecretLocation
    | FreeTrialSecretLocation
    | LocalEnvSecretLocation;
  fqsn: FQSN;
}

export interface FoundUserSecretResult {
  found: true;
  secretLocation: UserSecretLocation;
  value: string;
  fqsn: FQSN;
}

export type SecretResult =
  | FoundSecretResult
  | FoundUserSecretResult
  | NotFoundSecretResult;
