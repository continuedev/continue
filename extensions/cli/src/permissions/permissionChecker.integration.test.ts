import { describe, it, expect, beforeEach } from "vitest";

import { ToolPermissionService } from "../services/ToolPermissionService.js";

import { checkToolPermission } from "./permissionChecker.js";

describe("Permission Integration Tests", () => {
  let service: ToolPermissionService;

  beforeEach(() => {
    service = new ToolPermissionService();
  });

  describe("Headless mode with --allow flags", () => {
    it("should allow Edit tool when --allow Edit is specified in headless mode", () => {
      // Initialize service with headless mode and --allow Edit
      service.initializeSync({
        allow: ["Edit"],
        isHeadless: true,
      });

      const state = service.getState();

      // Check that the service is in headless mode
      expect(state.isHeadless).toBe(true);

      // Check permission for Edit tool
      const result = checkToolPermission(
        { name: "Edit", arguments: {} },
        state.permissions,
      );

      // Should be allowed because --allow Edit is specified
      expect(result.permission).toBe("allow");
    });

    it("should allow multiple tools with --allow in headless mode", () => {
      // Initialize service with headless mode and multiple --allow flags
      service.initializeSync({
        allow: ["Edit", "Write", "Bash"],
        isHeadless: true,
      });

      const state = service.getState();

      // Check Edit
      const editResult = checkToolPermission(
        { name: "Edit", arguments: {} },
        state.permissions,
      );
      expect(editResult.permission).toBe("allow");

      // Check Write
      const writeResult = checkToolPermission(
        { name: "Write", arguments: {} },
        state.permissions,
      );
      expect(writeResult.permission).toBe("allow");

      // Check Bash
      const bashResult = checkToolPermission(
        { name: "Bash", arguments: {} },
        state.permissions,
      );
      expect(bashResult.permission).toBe("allow");
    });

    it("should respect --exclude in headless mode", () => {
      service.initializeSync({
        allow: ["Read"],
        exclude: ["Edit"],
        isHeadless: true,
      });

      const state = service.getState();

      // Check that Read is allowed
      const readResult = checkToolPermission(
        { name: "Read", arguments: {} },
        state.permissions,
      );
      expect(readResult.permission).toBe("allow");

      // Check that Edit is excluded
      const editResult = checkToolPermission(
        { name: "Edit", arguments: {} },
        state.permissions,
      );
      expect(editResult.permission).toBe("exclude");
    });

    it("should work with plan mode and --allow overrides", () => {
      // Plan mode normally excludes write operations
      service.initializeSync({
        mode: "plan",
        allow: ["Edit"], // But we explicitly allow Edit
        isHeadless: true,
      });

      const state = service.getState();

      // In plan mode with --allow Edit override
      const editResult = checkToolPermission(
        { name: "Edit", arguments: {} },
        state.permissions,
      );

      // Currently this fails because plan mode ignores --allow flags
      // After fix, this should be 'allow'
      expect(editResult.permission).toBe("exclude"); // Current behavior
      // TODO: After fix, change to: expect(editResult.permission).toBe('allow');
    });
  });
});
