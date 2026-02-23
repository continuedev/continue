import { parseProxyModelName } from "./modelName.js";

describe("parseProxyModelName", () => {
  it("parses a basic model name correctly", () => {
    const result = parseProxyModelName("owner/package/provider/model");
    expect(result).toEqual({
      ownerSlug: "owner",
      packageSlug: "package",
      provider: "provider",
      model: "model",
    });
  });

  it("handles model names with slashes in the model part", () => {
    const result = parseProxyModelName(
      "owner/package/provider/model/with/slashes",
    );
    expect(result).toEqual({
      ownerSlug: "owner",
      packageSlug: "package",
      provider: "provider",
      model: "model/with/slashes",
    });
  });

  it("throws an error for invalid model formats (missing provider)", () => {
    expect(() => {
      parseProxyModelName("owner/package");
    }).toThrow("Invalid model format");
  });

  it("throws an error for invalid model formats (missing model)", () => {
    expect(() => {
      parseProxyModelName("owner/package/provider");
    }).toThrow("Invalid model format");
  });

  it("throws an error for empty string", () => {
    expect(() => {
      parseProxyModelName("");
    }).toThrow("Invalid model format");
  });
});
