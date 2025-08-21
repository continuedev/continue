import {
  convertLegacyModeFlags,
  buildPermissionOverrides,
  processCommandFlags,
} from "./flagProcessor.js";

describe("convertLegacyModeFlags", () => {
  test("should return 'plan' when readonly is true", () => {
    expect(convertLegacyModeFlags(true, false)).toBe("plan");
  });

  test("should return 'auto' when auto is true", () => {
    expect(convertLegacyModeFlags(false, true)).toBe("auto");
  });

  test("should return undefined when both flags are false", () => {
    expect(convertLegacyModeFlags(false, false)).toBeUndefined();
  });

  test("should return undefined when no flags provided", () => {
    expect(convertLegacyModeFlags()).toBeUndefined();
  });

  test("should throw error when both readonly and auto are true", () => {
    expect(() => convertLegacyModeFlags(true, true)).toThrow(
      "Cannot use both --readonly and --auto flags together",
    );
  });
});

describe("buildPermissionOverrides", () => {
  test("should build permission overrides with all parameters", () => {
    const result = buildPermissionOverrides(
      ["readFile"],
      ["writeFile"],
      ["runTerminalCommand"],
      "plan",
    );

    expect(result).toEqual({
      allow: ["readFile"],
      ask: ["writeFile"],
      exclude: ["runTerminalCommand"],
      mode: "plan",
    });
  });

  test("should handle undefined parameters", () => {
    const result = buildPermissionOverrides();

    expect(result).toEqual({
      allow: undefined,
      ask: undefined,
      exclude: undefined,
      mode: undefined,
    });
  });

  test("should handle partial parameters", () => {
    const result = buildPermissionOverrides(["readFile"], undefined, ["Write"]);

    expect(result).toEqual({
      allow: ["readFile"],
      ask: undefined,
      exclude: ["Write"],
      mode: undefined,
    });
  });
});

describe("processCommandFlags", () => {
  test("should process readonly flag correctly", () => {
    const result = processCommandFlags({
      readonly: true,
      allow: ["readFile"],
      exclude: ["Write"],
    });

    expect(result).toEqual({
      mode: "plan",
      permissionOverrides: {
        allow: ["readFile"],
        ask: undefined,
        exclude: ["Write"],
        mode: "plan",
      },
    });
  });

  test("should process auto flag correctly", () => {
    const result = processCommandFlags({
      auto: true,
      ask: ["writeFile"],
    });

    expect(result).toEqual({
      mode: "auto",
      permissionOverrides: {
        allow: undefined,
        ask: ["writeFile"],
        exclude: undefined,
        mode: "auto",
      },
    });
  });

  test("should handle no mode flags", () => {
    const result = processCommandFlags({
      allow: ["readFile", "searchCode"],
    });

    expect(result).toEqual({
      mode: undefined,
      permissionOverrides: {
        allow: ["readFile", "searchCode"],
        ask: undefined,
        exclude: undefined,
        mode: undefined,
      },
    });
  });

  test("should throw error for conflicting flags", () => {
    expect(() =>
      processCommandFlags({
        readonly: true,
        auto: true,
      }),
    ).toThrow("Cannot use both --readonly and --auto flags together");
  });

  test("should handle empty options", () => {
    const result = processCommandFlags({});

    expect(result).toEqual({
      mode: undefined,
      permissionOverrides: {
        allow: undefined,
        ask: undefined,
        exclude: undefined,
        mode: undefined,
      },
    });
  });
});
