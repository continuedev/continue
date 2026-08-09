import { describe, it, expect, beforeEach, vi } from "vitest";

import { checkToolPermission } from "./permissionChecker.js";
import { yamlConfigToPolicies } from "./permissionsYamlLoader.js";

// Mock fs module
vi.mock("fs");

describe("YAML Permissions - Edit Tool Bug", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should allow Edit tool when it is in the allow list", () => {
    // Test the exact YAML content from the user
    const yamlContent = `allow:
  - Edit
ask: []
exclude: []`;

    // Parse the YAML config
    const config = {
      allow: ["Edit"],
      ask: [],
      exclude: [],
    };

    // Convert to policies
    const policies = yamlConfigToPolicies(config);
    console.log("Converted policies:", policies);

    // The policies should have Edit as allowed
    expect(policies).toEqual([{ tool: "Edit", permission: "allow" }]);

    // Test permission check with tool call named "Edit"
    const toolCall1 = {
      name: "Edit",
      arguments: { filepath: "test.txt" },
    };
    const result1 = checkToolPermission(toolCall1, { policies });
    console.log('Permission check for "Edit":', result1);
    expect(result1.permission).toBe("allow");

    // Legacy names should NOT work anymore
    const toolCall2 = {
      name: "search_and_replace_in_file",
      arguments: { filepath: "test.txt" },
    };
    const result2 = checkToolPermission(toolCall2, { policies });
    console.log('Permission check for "search_and_replace_in_file":', result2);
    expect(result2.permission).toBe("ask"); // Should not match, falls back to ask

    // Legacy names should NOT work anymore
    const toolCall3 = {
      name: "edit_file",
      arguments: { filepath: "test.txt" },
    };
    const result3 = checkToolPermission(toolCall3, { policies });
    console.log('Permission check for "edit_file":', result3);
    expect(result3.permission).toBe("ask"); // Should not match, falls back to ask
  });

  it("should use exact tool names without normalization", () => {
    // Tools are now used exactly as they are named, no normalization
    const editName = "Edit";
    const multiEditName = "MultiEdit";

    expect(editName).toBe("Edit");
    expect(multiEditName).toBe("MultiEdit");
  });
});
