import {
  decodeFQSN,
  decodeFullSlug,
  decodePackageSlug,
  encodeFQSN,
  encodeFullSlug,
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
