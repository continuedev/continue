import { FQSN, PackageSlug, encodePackageSlug } from "./slugs.js";

export enum SecretType {
  User = "user",
  Package = "package",
  Organization = "organization",
  NotFound = "not_found",
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
  | NotFoundSecretLocation;

export function encodeSecretLocation(secretLocation: SecretLocation): string {
  if (secretLocation.secretType === SecretType.Organization) {
    return `${SecretType.Organization}:${secretLocation.orgSlug}/${secretLocation.secretName}`;
  } else if (secretLocation.secretType === SecretType.User) {
    return `${SecretType.User}:${secretLocation.userSlug}/${secretLocation.secretName}`;
  } else if (secretLocation.secretType === SecretType.Package) {
    return `${SecretType.Package}:${encodePackageSlug(secretLocation.packageSlug)}/${secretLocation.secretName}`;
  } else if (secretLocation.secretType === SecretType.NotFound) {
    return `${SecretType.NotFound}:${secretLocation.secretName}`;
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
  secretLocation: OrgSecretLocation | PackageSecretLocation;
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
