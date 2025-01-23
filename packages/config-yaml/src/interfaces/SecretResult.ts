import { FQSN, PackageSlug, encodePackageSlug } from "./slugs.js";

export enum SecretType {
  User = "user",
  Package = "package",
  Organization = "organization",
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

export type SecretLocation =
  | OrgSecretLocation
  | PackageSecretLocation
  | UserSecretLocation;

export function encodeSecretLocation(secretLocation: SecretLocation): string {
  if (secretLocation.secretType === SecretType.Organization) {
    return `${SecretType.Organization}:${secretLocation.orgSlug}/${secretLocation.secretName}`;
  } else if (secretLocation.secretType === SecretType.User) {
    return `${SecretType.User}:${secretLocation.userSlug}/${secretLocation.secretName}`;
  } else {
    return `${SecretType.Package}:${encodePackageSlug(secretLocation.packageSlug)}/${secretLocation.secretName}`;
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
    default:
      throw new Error(`Invalid secret type: ${secretType}`);
  }
}

export interface NotFoundSecretResult {
  found: false;
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
