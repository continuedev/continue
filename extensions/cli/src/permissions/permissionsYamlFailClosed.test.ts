import fs from "fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("fs");

import {
  loadPermissionsYaml,
  loadPermissionsYamlResult,
} from "./permissionsYamlLoader.js";
import { addPolicyToYaml } from "./policyWriter.js";
import { resolvePermissionPrecedence } from "./precedenceResolver.js";

const mockedFs = fs as unknown as {
  existsSync: ReturnType<typeof vi.fn>;
  readFileSync: ReturnType<typeof vi.fn>;
  promises: { writeFile: ReturnType<typeof vi.fn> };
};

describe("permissions.yaml fail-closed loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports absent when the file does not exist", () => {
    mockedFs.existsSync.mockReturnValue(false);

    expect(loadPermissionsYamlResult()).toEqual({ status: "absent" });
    expect(loadPermissionsYaml()).toBeNull();
  });

  it("reports valid for a well-formed ask policy", () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue("ask:\n  - Bash\n");

    expect(loadPermissionsYamlResult()).toEqual({
      status: "valid",
      config: { ask: ["Bash"] },
    });
    expect(loadPermissionsYaml()).toEqual({ ask: ["Bash"] });
  });

  it("reports unreadable for invalid structure", () => {
    mockedFs.existsSync.mockReturnValue(true);
    // ask must be a list; a bare string is invalid
    mockedFs.readFileSync.mockReturnValue("ask: Bash\n");

    const result = loadPermissionsYamlResult();
    expect(result.status).toBe("unreadable");
    if (result.status === "unreadable") {
      expect(result.reason).toBe("invalid_structure");
    }
    expect(loadPermissionsYaml()).toBeNull();
  });

  it("reports unreadable for YAML syntax errors", () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue('ask: ["Bash"\n');

    const result = loadPermissionsYamlResult();
    expect(result.status).toBe("unreadable");
    if (result.status === "unreadable") {
      expect(result.reason).toBe("parse_error");
    }
    expect(loadPermissionsYaml()).toBeNull();
  });

  it("puts fail-closed ask-all ahead of headless allow defaults when unreadable", () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue('ask: ["Bash"\n');

    const policies = resolvePermissionPrecedence({
      personalSettings: true,
      useDefaults: true,
      isHeadless: true,
    });

    // First match wins: "*" ask must precede the headless Bash/* allow defaults
    expect(policies[0]).toEqual({ tool: "*", permission: "ask" });
    expect(
      policies.some((p) => p.tool === "Bash" && p.permission === "allow"),
    ).toBe(true);
  });

  it("still surfaces a valid ask: Bash policy ahead of headless defaults", () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue("ask:\n  - Bash\n");

    const policies = resolvePermissionPrecedence({
      personalSettings: true,
      useDefaults: true,
      isHeadless: true,
    });

    expect(policies[0]).toEqual({ tool: "Bash", permission: "ask" });
  });

  it("refuses to rewrite permissions.yaml from an empty config when unreadable", async () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue('ask: ["Bash"\n');

    await expect(addPolicyToYaml("Write")).rejects.toThrow(
      /could not be parsed/,
    );
  });
});
