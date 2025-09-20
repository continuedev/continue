type ProcessWithEnv = {
  env?: Record<string, string | undefined>;
};

function getProcessEnv(): Record<string, string | undefined> | undefined {
  if (
    typeof process !== "undefined" &&
    process &&
    typeof process === "object"
  ) {
    return (process as ProcessWithEnv).env;
  }

  if (typeof globalThis !== "undefined") {
    const maybeProcess = (globalThis as { process?: ProcessWithEnv }).process;
    return maybeProcess?.env;
  }

  return undefined;
}

function getHomeDirectory(): string | undefined {
  const env = getProcessEnv();

  const fromHome = env?.HOME?.trim();
  if (fromHome) {
    return fromHome;
  }

  const fromUserProfile = env?.USERPROFILE?.trim();
  if (fromUserProfile) {
    return fromUserProfile;
  }

  return undefined;
}

function expandLeadingTilde(identifier: string): string {
  const homeDirectory = getHomeDirectory();
  if (!homeDirectory) {
    return identifier;
  }

  // Only replace a leading ~ so relative paths like ../~file stay untouched
  return homeDirectory + identifier.slice(1);
}

export interface PackageSlug {
  ownerSlug: string;
  packageSlug: string;
}

export interface FullSlug extends PackageSlug {
  versionSlug: string;
}

// Identifier roughly equals URI, except that we want to provide shorthand for slugs and filepaths
// Later it is possible to allow URIs as well since they can be uniquely parsed
interface BasePackageIdentifier {
  uriType: "file" | "slug";
}

interface FullSlugIdentifier extends BasePackageIdentifier {
  uriType: "slug";
  fullSlug: FullSlug;
}

interface FileIdentifier extends BasePackageIdentifier {
  uriType: "file";
  fileUri: string;
}

export type PackageIdentifier = FullSlugIdentifier | FileIdentifier;

export function packageIdentifierToDisplayName(id: PackageIdentifier): string {
  switch (id.uriType) {
    case "file":
      return id.fileUri;
    case "slug":
      return id.fullSlug.packageSlug;
  }
}

export function encodePackageIdentifier(identifier: PackageIdentifier): string {
  switch (identifier.uriType) {
    case "slug":
      return encodeFullSlug(identifier.fullSlug);
    case "file":
      // For file paths, just return the path directly without a prefix
      return identifier.fileUri;
    default:
      throw new Error(`Unknown URI type: ${(identifier as any).uriType}`);
  }
}

export function decodePackageIdentifier(identifier: string): PackageIdentifier {
  // Shorthand: if it starts with . or /, then it's a path
  if (identifier.startsWith(".") || identifier.startsWith("/")) {
    return {
      uriType: "file",
      fileUri: identifier,
    };
  }
  // Keep support for explicit file:// protocol
  else if (identifier.startsWith("file://")) {
    return {
      uriType: "file",
      fileUri: identifier.substring(7),
    };
  }
  // support ~ by replacing with home directory
  else if (identifier.startsWith("~")) {
    return {
      uriType: "file",
      fileUri: expandLeadingTilde(identifier),
    };
  }
  // Otherwise, it's a slug
  return {
    uriType: "slug",
    fullSlug: decodeFullSlug(identifier),
  };
}

export enum VirtualTags {
  Latest = "latest",
}

export function encodePackageSlug(packageSlug: PackageSlug): string {
  return `${packageSlug.ownerSlug}/${packageSlug.packageSlug}`;
}

export function decodePackageSlug(pkgSlug: string): PackageSlug {
  const [ownerSlug, packageSlug] = pkgSlug.split("/");
  return {
    ownerSlug,
    packageSlug,
  };
}

export function encodeFullSlug(fullSlug: FullSlug): string {
  return `${fullSlug.ownerSlug}/${fullSlug.packageSlug}@${fullSlug.versionSlug}`;
}

export function packageSlugsEqual(
  pkgSlug1: PackageSlug,
  pkgSlug2: PackageSlug,
): boolean {
  return (
    pkgSlug1.ownerSlug === pkgSlug2.ownerSlug &&
    pkgSlug1.packageSlug === pkgSlug2.packageSlug
  );
}

export function decodeFullSlug(fullSlug: string): FullSlug {
  const [ownerSlug, packageSlug, versionSlug] = fullSlug.split(/[/@]/);
  return {
    ownerSlug,
    packageSlug,
    versionSlug: versionSlug || VirtualTags.Latest,
  };
}

/**
 * FQSN = Fully Qualified Secret Name
 */
export interface FQSN {
  packageSlugs: PackageSlug[];
  secretName: string;
}

export function encodeFQSN(fqsn: FQSN): string {
  const parts = [...fqsn.packageSlugs.map(encodePackageSlug), fqsn.secretName];
  return parts.join("/");
}

export function decodeFQSN(fqsn: string): FQSN {
  const parts = fqsn.split("/");
  const secretName = parts.pop()!;
  const packageSlugs: PackageSlug[] = [];

  // Process parts two at a time to decode package slugs
  for (let i = 0; i < parts.length; i += 2) {
    if (i + 1 >= parts.length) {
      throw new Error("Invalid FQSN format: package slug must have two parts");
    }
    packageSlugs.push({
      ownerSlug: parts[i],
      packageSlug: parts[i + 1],
    });
  }

  return { packageSlugs, secretName };
}
