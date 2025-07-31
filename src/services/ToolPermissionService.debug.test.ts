import { beforeEach, describe, expect, it } from "@jest/globals";
import { PermissionMode } from "../permissions/types.js";
import { ToolPermissionService } from "./ToolPermissionService.js";

describe("ToolPermissionService - Debug Tool Permissions", () => {
  let service: ToolPermissionService;

  beforeEach(() => {
    service = new ToolPermissionService();
  });

  const testModes: PermissionMode[] = ["normal", "plan", "auto"];

  testModes.forEach((mode) => {
    describe(`${mode} mode`, () => {
      beforeEach(() => {
        service.initializeSync({ mode });
      });

      it(`should have correct Write tool permission in ${mode} mode`, () => {
        const policies = service.getPermissions().policies;
        console.log(`\n=== ${mode.toUpperCase()} MODE POLICIES ===`);
        // policies.forEach((policy, index) => {
        //   console.log(`${index + 1}. tool: "${policy.tool}", permission: "${policy.permission}"`);
        // });

        const writeFilePolicy = policies.find((p) => p.tool === "write_file");
        const writePolicy = policies.find((p) => p.tool === "Write");
        const wildcardPolicy = policies.find((p) => p.tool === "*");

        if (mode === "plan") {
          // Plan mode should explicitly exclude write_file
          expect(writeFilePolicy?.permission).toBe("exclude");
          console.log(`✓ write_file tool correctly excluded in plan mode`);
        } else if (mode === "auto") {
          // Auto mode should allow everything
          expect(wildcardPolicy?.permission).toBe("allow");
          console.log(`✓ Wildcard allow policy found in auto mode`);
        } else {
          // Normal mode behavior depends on user config
          console.log(
            `Normal mode - write_file policy: ${
              writeFilePolicy?.permission || "none"
            }`
          );
        }
      });

      it(`should check tool resolution order in ${mode} mode`, () => {
        const policies = service.getPermissions().policies;

        // Find all policies that could affect write_file tool
        const writeRelevantPolicies = policies.filter(
          (p) => p.tool === "write_file" || p.tool === "Write" || p.tool === "*"
        );

        console.log(
          `\n=== WRITE-RELEVANT POLICIES IN ${mode.toUpperCase()} MODE ===`
        );
        writeRelevantPolicies.forEach((policy, index) => {
          console.log(
            `${index + 1}. tool: "${policy.tool}", permission: "${
              policy.permission
            }"`
          );
        });

        if (mode === "plan") {
          // Should have write_file exclude policy BEFORE any wildcard
          const writeIndex = policies.findIndex((p) => p.tool === "write_file");
          const wildcardIndex = policies.findIndex((p) => p.tool === "*");

          expect(writeIndex).toBeGreaterThanOrEqual(0);
          if (wildcardIndex >= 0) {
            expect(writeIndex).toBeLessThan(wildcardIndex);
          }
          expect(policies[writeIndex].permission).toBe("exclude");
        }
      });
    });
  });

  it("should demonstrate policy precedence with user config", () => {
    // Initialize with user config that allows Write
    service.initializeSync({
      allow: ["Write"],
      mode: "normal",
    });

    console.log("\n=== NORMAL MODE WITH USER ALLOW WRITE ===");
    let policies = service.getPermissions().policies;
    policies.forEach((policy, index) => {
      console.log(
        `${index + 1}. tool: "${policy.tool}", permission: "${
          policy.permission
        }"`
      );
    });

    // Switch to plan mode - should override user config
    service.switchMode("plan");

    console.log("\n=== AFTER SWITCHING TO PLAN MODE ===");
    policies = service.getPermissions().policies;
    policies.forEach((policy, index) => {
      console.log(
        `${index + 1}. tool: "${policy.tool}", permission: "${
          policy.permission
        }"`
      );
    });

    const writeFilePolicy = policies.find((p) => p.tool === "write_file");
    expect(writeFilePolicy?.permission).toBe("exclude");
  });
});
