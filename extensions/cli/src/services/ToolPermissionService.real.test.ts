import { beforeEach, describe, expect, it } from "vitest";

import { checkToolPermission } from "../permissions/permissionChecker.js";

import { ToolPermissionService } from "./ToolPermissionService.js";

describe("ToolPermissionService - Real Tool Permission Test", () => {
  let service: ToolPermissionService;

  beforeEach(() => {
    service = new ToolPermissionService();
  });

  describe("Plan Mode Real Tool Tests", () => {
    beforeEach(() => {
      service.initializeSync({ mode: "plan" });
    });

    it("should deny Write tool in plan mode", () => {
      const permissions = service.getPermissions();
      const toolCall = {
        name: "Write",
        arguments: { path: "test.txt", content: "test" },
      };
      const result = checkToolPermission(toolCall, permissions);

      console.log(`Write permission check result:`, result);
      expect(result.permission).toBe("exclude");
    });

    it("should deny Edit tool in plan mode", () => {
      const permissions = service.getPermissions();
      const toolCall = {
        name: "Edit",
        arguments: { path: "test.txt", old_str: "old", new_str: "new" },
      };
      const result = checkToolPermission(toolCall, permissions);

      console.log(`Edit permission check result:`, result);
      expect(result.permission).toBe("exclude");
    });

    it("should allow Bash tool in plan mode", () => {
      const permissions = service.getPermissions();
      const toolCall = {
        name: "Bash",
        arguments: { command: "ls" },
      };
      const result = checkToolPermission(toolCall, permissions);

      console.log(`Bash permission check result:`, result);
      expect(result.permission).toBe("allow");
    });

    it("should allow Read tool in plan mode", () => {
      const permissions = service.getPermissions();
      const toolCall = {
        name: "Read",
        arguments: { path: "test.txt" },
      };
      const result = checkToolPermission(toolCall, permissions);

      console.log(`Read permission check result:`, result);
      expect(result.permission).toBe("allow");
    });

    it("should allow List tool in plan mode", () => {
      const permissions = service.getPermissions();
      const toolCall = {
        name: "List",
        arguments: { path: "." },
      };
      const result = checkToolPermission(toolCall, permissions);

      console.log(`List permission check result:`, result);
      expect(result.permission).toBe("allow");
    });

    it("should allow unknown tools in plan mode (for MCP tools via wildcard)", () => {
      const permissions = service.getPermissions();
      const toolCall = {
        name: "some_mcp_tool",
        arguments: {},
      };
      const result = checkToolPermission(toolCall, permissions);

      console.log(`some_mcp_tool permission check result:`, result);
      // Plan mode allows MCP and other non-write tools via wildcard
      expect(result.permission).toBe("allow");
    });
  });

  describe("Auto Mode Real Tool Tests", () => {
    beforeEach(() => {
      service.initializeSync({ mode: "auto" });
    });

    it("should allow Write tool in auto mode", () => {
      const permissions = service.getPermissions();
      const toolCall = {
        name: "Write",
        arguments: { path: "test.txt", content: "test" },
      };
      const result = checkToolPermission(toolCall, permissions);

      console.log(`Auto mode Write permission check result:`, result);
      expect(result.permission).toBe("allow");
    });

    it("should allow Bash tool in auto mode", () => {
      const permissions = service.getPermissions();
      const toolCall = {
        name: "Bash",
        arguments: { command: "ls" },
      };
      const result = checkToolPermission(toolCall, permissions);

      console.log(`Auto mode Bash permission check result:`, result);
      expect(result.permission).toBe("allow");
    });

    it("should allow unknown tools in auto mode (wildcard allow)", () => {
      const permissions = service.getPermissions();
      const toolCall = {
        name: "unknown_tool",
        arguments: {},
      };
      const result = checkToolPermission(toolCall, permissions);

      console.log(`Auto mode unknown_tool permission check result:`, result);
      expect(result.permission).toBe("allow");
    });
  });

  describe("Mode Override Test", () => {
    it("should override user permissions when switching to plan mode", () => {
      // Start with user explicitly allowing Write
      service.initializeSync({
        allow: ["Write"],
        mode: "normal",
      });

      // Verify Write is allowed in normal mode
      let permissions = service.getPermissions();
      const toolCall = {
        name: "Write",
        arguments: { path: "test.txt", content: "test" },
      };
      let result = checkToolPermission(toolCall, permissions);
      console.log(`Normal mode with user allow - Write result:`, result);
      expect(result.permission).toBe("allow");

      // Switch to plan mode - should OVERRIDE user config completely
      service.switchMode("plan");
      permissions = service.getPermissions();
      result = checkToolPermission(toolCall, permissions);

      console.log(`After switching to plan mode - write_file result:`, result);
      console.log(
        `Plan mode policies:`,
        permissions.policies.map((p) => `${p.tool}:${p.permission}`),
      );
      expect(result.permission).toBe("exclude");
    });
  });
});
