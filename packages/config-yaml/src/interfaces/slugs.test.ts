import {
  decodeFQSN,
  decodeFullSlug,
  decodePackageIdentifier,
  decodePackageSlug,
  encodeFQSN,
  encodeFullSlug,
  encodePackageIdentifier,
  encodePackageSlug,
  VirtualTags,
} from "./slugs.js";

describe("PackageSlug", () => {
  it("should encode/decode package slugs", () => {
    const testSlug = {
      ownerSlug: "test-owner",
      packageSlug: "test-package",
    };
    const encoded = encodePackageSlug(testSlug);
    expect(encoded).toBe("test-owner/test-package");
    const decoded = decodePackageSlug(encoded);
    expect(decoded).toEqual(testSlug);
  });

  it("should encode/decode full slugs", () => {
    const testFullSlug = {
      ownerSlug: "test-owner",
      packageSlug: "test-package",
      versionSlug: "1.0.0",
    };
    const encoded = encodeFullSlug(testFullSlug);
    expect(encoded).toBe("test-owner/test-package@1.0.0");
    const decoded = decodeFullSlug(encoded);
    expect(decoded).toEqual(testFullSlug);
  });

  it("should use latest tag when no version provided", () => {
    const encoded = "test-owner/test-package";
    const decoded = decodeFullSlug(encoded);
    expect(decoded.versionSlug).toBe(VirtualTags.Latest);
  });

  it("should encode/decode FQSN with single package", () => {
    const testFQSN = {
      packageSlugs: [
        {
          ownerSlug: "test-owner",
          packageSlug: "test-package",
        },
      ],
      secretName: "test-secret",
    };
    const encoded = encodeFQSN(testFQSN);
    expect(encoded).toBe("test-owner/test-package/test-secret");
    const decoded = decodeFQSN(encoded);
    expect(decoded).toEqual(testFQSN);
  });

  it("should encode/decode FQSN with multiple packages", () => {
    const testFQSN = {
      packageSlugs: [
        {
          ownerSlug: "owner1",
          packageSlug: "package1",
        },
        {
          ownerSlug: "owner2",
          packageSlug: "package2",
        },
      ],
      secretName: "test-secret",
    };
    const encoded = encodeFQSN(testFQSN);
    expect(encoded).toBe("owner1/package1/owner2/package2/test-secret");
    const decoded = decodeFQSN(encoded);
    expect(decoded).toEqual(testFQSN);
  });

  it("should throw error for invalid FQSN format", () => {
    expect(() => decodeFQSN("owner1/package1/owner2/test-secret")).toThrow(
      "Invalid FQSN format: package slug must have two parts",
    );
  });
});

describe("PackageIdentifier", () => {
  it("should encode/decode slug-based package identifier", () => {
    const testIdentifier = {
      uriType: "slug" as const,
      fullSlug: {
        ownerSlug: "test-owner",
        packageSlug: "test-package",
        versionSlug: "2.1.0",
      },
    };
    const encoded = encodePackageIdentifier(testIdentifier);
    expect(encoded).toBe("test-owner/test-package@2.1.0");

    const decoded = decodePackageIdentifier(encoded);
    expect(decoded).toEqual(testIdentifier);
  });

  it("should encode/decode slug-based package identifier without version", () => {
    const encoded = "test-owner/test-package";
    const decoded = decodePackageIdentifier(encoded);

    expect(decoded).toEqual({
      uriType: "slug",
      fullSlug: {
        ownerSlug: "test-owner",
        packageSlug: "test-package",
        versionSlug: VirtualTags.Latest,
      },
    });
  });

  it("should encode/decode file-based package identifier with relative path", () => {
    const testIdentifier = {
      uriType: "file" as const,
      fileUri: "./path/to/package.yaml",
    };
    const encoded = encodePackageIdentifier(testIdentifier);
    expect(encoded).toBe("./path/to/package.yaml");

    const decoded = decodePackageIdentifier(encoded);
    expect(decoded).toEqual(testIdentifier);
  });

  it("should encode/decode file-based package identifier with absolute path", () => {
    const testIdentifier = {
      uriType: "file" as const,
      fileUri: "/absolute/path/to/package.yaml",
    };
    const encoded = encodePackageIdentifier(testIdentifier);
    expect(encoded).toBe("/absolute/path/to/package.yaml");

    const decoded = decodePackageIdentifier(encoded);
    expect(decoded).toEqual(testIdentifier);
  });

  it("should decode file-based package identifier with file:// protocol", () => {
    const encoded = "file:///path/to/package.yaml";
    const decoded = decodePackageIdentifier(encoded);

    expect(decoded).toEqual({
      uriType: "file" as const,
      fileUri: "/path/to/package.yaml",
    });
  });

  it("should throw error for unknown URI type", () => {
    const invalidIdentifier = {
      uriType: "invalid",
      data: "something",
    };

    expect(() => encodePackageIdentifier(invalidIdentifier as any)).toThrow(
      "Unknown URI type: invalid",
    );
  });

  it("should expand leading tilde when HOME is available", () => {
    const originalHome = process.env.HOME;
    const originalUserProfile = process.env.USERPROFILE;

    try {
      process.env.HOME = "/tmp/test-home";
      delete process.env.USERPROFILE;

      const decoded = decodePackageIdentifier("~/package.yaml");

      expect(decoded).toEqual({
        uriType: "file" as const,
        fileUri: "/tmp/test-home/package.yaml",
      });
    } finally {
      if (originalHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = originalHome;
      }

      if (originalUserProfile === undefined) {
        delete process.env.USERPROFILE;
      } else {
        process.env.USERPROFILE = originalUserProfile;
      }
    }
  });

  it("should leave leading tilde when no home directory is available", () => {
    const originalHome = process.env.HOME;
    const originalUserProfile = process.env.USERPROFILE;

    try {
      delete process.env.HOME;
      delete process.env.USERPROFILE;

      const decoded = decodePackageIdentifier("~/package.yaml");

      expect(decoded).toEqual({
        uriType: "file" as const,
        fileUri: "~/package.yaml",
      });
    } finally {
      if (originalHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = originalHome;
      }

      if (originalUserProfile === undefined) {
        delete process.env.USERPROFILE;
      } else {
        process.env.USERPROFILE = originalUserProfile;
      }
    }
  });
});
