import {
  SecretType,
  decodeSecretLocation,
  encodeSecretLocation,
} from "./SecretResult.js";
import { PackageSlug } from "./slugs.js";

describe("SecretLocation encoding/decoding", () => {
  it("encodes/decodes organization secret location", () => {
    const orgSecretLocation = {
      secretType: SecretType.Organization as const,
      orgSlug: "test-org",
      secretName: "secret1",
    };

    const encoded = encodeSecretLocation(orgSecretLocation);
    expect(encoded).toBe("organization:test-org/secret1");

    const decoded = decodeSecretLocation(encoded);
    expect(decoded).toEqual(orgSecretLocation);
  });

  it("encodes/decodes package secret location", () => {
    const packageSlug: PackageSlug = {
      ownerSlug: "test-org",
      packageSlug: "test-package",
    };

    const packageSecretLocation = {
      secretType: SecretType.Package as const,
      packageSlug,
      secretName: "secret1",
    };

    const encoded = encodeSecretLocation(packageSecretLocation);
    expect(encoded).toBe("package:test-org/test-package/secret1");

    const decoded = decodeSecretLocation(encoded);
    expect(decoded).toEqual(packageSecretLocation);
  });
});
