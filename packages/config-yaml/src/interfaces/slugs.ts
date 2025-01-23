export interface PackageSlug {
  ownerSlug: string;
  packageSlug: string;
}
export interface FullSlug extends PackageSlug {
  versionSlug: string;
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
