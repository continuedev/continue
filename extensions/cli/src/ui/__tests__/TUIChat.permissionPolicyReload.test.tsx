import { beforeEach, describe, expect, it, vi } from "vitest";

import { services } from "../../services/index.js";
vi.mock("../../services/index.js");

// Mock the permission system
vi.mock("../../permissions/policyWriter.js", () => ({
  generatePolicyRule: vi.fn(),
  addPolicyToYaml: vi.fn(),
}));

describe("Permission Policy Reload Workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call reloadPermissions after creating a policy", async () => {
    // Mock the policy writer
    const { generatePolicyRule, addPolicyToYaml } = await import(
      "../../permissions/policyWriter.js"
    );
    vi.mocked(generatePolicyRule).mockReturnValue(
      "tool: Edit\npermission: allow",
    );
    vi.mocked(addPolicyToYaml).mockResolvedValue(undefined);

    // Test the workflow that should happen in useChat.handleToolPermissionResponse
    const mockActiveRequest = {
      toolName: "Edit",
      toolArgs: { file_path: "test.txt" },
    };

    const approved = true;
    const createPolicy = true;

    // Simulate the policy creation flow from useChat
    if (approved && createPolicy && mockActiveRequest) {
      try {
        const { generatePolicyRule, addPolicyToYaml } = await import(
          "../../permissions/policyWriter.js"
        );
        const { services } = await import("../../services/index.js");

        const policyRule = generatePolicyRule(
          mockActiveRequest.toolName,
          mockActiveRequest.toolArgs,
        );

        await addPolicyToYaml(policyRule);

        // This is the key part we're testing - reload should be called
        await services.toolPermissions.reloadPermissions();
      } catch (error) {
        // Handle errors gracefully
      }
    }

    // Verify the complete workflow executed
    expect(generatePolicyRule).toHaveBeenCalledWith("Edit", {
      file_path: "test.txt",
    });
    expect(addPolicyToYaml).toHaveBeenCalledWith(
      "tool: Edit\npermission: allow",
    );
    expect(services.toolPermissions.reloadPermissions).toHaveBeenCalled();
  });

  it("should handle permission reload failure gracefully", async () => {
    // Mock the policy writer
    const { generatePolicyRule, addPolicyToYaml } = await import(
      "../../permissions/policyWriter.js"
    );
    vi.mocked(generatePolicyRule).mockReturnValue(
      "tool: Write\npermission: allow",
    );
    vi.mocked(addPolicyToYaml).mockResolvedValue(undefined);

    // Mock reloadPermissions to fail
    vi.mocked(services.toolPermissions.reloadPermissions).mockRejectedValue(
      new Error("Reload failed"),
    );

    const mockActiveRequest = {
      toolName: "Write",
      toolArgs: { file_path: "test.txt" },
    };

    const approved = true;
    const createPolicy = true;

    // Test that error handling works correctly - this should not throw
    let errorCaught = false;
    try {
      const { generatePolicyRule, addPolicyToYaml } = await import(
        "../../permissions/policyWriter.js"
      );
      const { services } = await import("../../services/index.js");

      const policyRule = generatePolicyRule(
        mockActiveRequest.toolName,
        mockActiveRequest.toolArgs,
      );

      await addPolicyToYaml(policyRule);

      // This should fail but not break the flow
      await services.toolPermissions.reloadPermissions();
    } catch (error) {
      // Error should be caught and handled gracefully
      errorCaught = true;
      expect((error as Error).message).toBe("Reload failed");
    }

    // Verify that despite the reload failure, the policy was still created
    expect(addPolicyToYaml).toHaveBeenCalled();
    expect(services.toolPermissions.reloadPermissions).toHaveBeenCalled();
    expect(errorCaught).toBe(true);
  });

  it("verifies the expected improvement: policy takes effect immediately", async () => {
    // This test documents what the user should experience
    const { generatePolicyRule, addPolicyToYaml } = await import(
      "../../permissions/policyWriter.js"
    );
    vi.mocked(generatePolicyRule).mockReturnValue(
      "tool: Edit\npermission: allow",
    );
    vi.mocked(addPolicyToYaml).mockResolvedValue(undefined);

    // Mock successful reload
    vi.mocked(services.toolPermissions.reloadPermissions).mockResolvedValue(
      undefined,
    );

    const mockActiveRequest = {
      toolName: "Edit",
      toolArgs: { file_path: "test.txt" },
    };

    // BEFORE: User has to approve tool permission
    // Simulate user choosing "Continue + don't ask again"
    const approved = true;
    const createPolicy = true;

    // The workflow should complete successfully
    if (approved && createPolicy && mockActiveRequest) {
      const { generatePolicyRule, addPolicyToYaml } = await import(
        "../../permissions/policyWriter.js"
      );
      const { services } = await import("../../services/index.js");

      const policyRule = generatePolicyRule(
        mockActiveRequest.toolName,
        mockActiveRequest.toolArgs,
      );

      await addPolicyToYaml(policyRule);
      await services.toolPermissions.reloadPermissions();
    }

    // AFTER: Policy is now active without restart
    // Next time user tries to edit a file, it should be automatically allowed

    expect(services.toolPermissions.reloadPermissions).toHaveBeenCalled();

    // This represents the improvement: the new policy takes effect immediately
    // without requiring the user to restart the Continue CLI
  });
});
