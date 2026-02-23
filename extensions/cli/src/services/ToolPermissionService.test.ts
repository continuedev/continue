import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock modules
vi.mock("../permissions/permissionsYamlLoader.js");
vi.mock("../permissions/precedenceResolver.js");

import * as precedenceResolver from "../permissions/precedenceResolver.js";
import { ToolPermissionPolicy } from "../permissions/types.js";

import { ToolPermissionService } from "./ToolPermissionService.js";

describe("ToolPermissionService", () => {
  let service: ToolPermissionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ToolPermissionService();
  });

  describe("State Management", () => {
    test("should initialize with default state", async () => {
      vi.mocked(precedenceResolver.resolvePermissionPrecedence).mockReturnValue(
        [],
      );

      const state = await service.initialize();

      expect(state).toEqual({
        permissions: { policies: [] },
        currentMode: "normal",
        isHeadless: false,
        modePolicyCount: 0,
      });
    });

    test("should initialize with runtime overrides", async () => {
      const mockPolicies: ToolPermissionPolicy[] = [
        { tool: "TestTool3", permission: "exclude" },
        { tool: "TestTool2", permission: "ask" },
        { tool: "TestTool1", permission: "allow" },
      ];

      vi.mocked(precedenceResolver.resolvePermissionPrecedence).mockReturnValue(
        mockPolicies,
      );

      const overrides = {
        allow: ["TestTool1"],
        ask: ["TestTool2"],
        exclude: ["TestTool3"],
      };

      const state = await service.initialize(overrides);

      expect(state.permissions.policies).toEqual(mockPolicies);
      expect(
        precedenceResolver.resolvePermissionPrecedence,
      ).toHaveBeenCalledWith({
        commandLineFlags: overrides,
        personalSettings: true,
        useDefaults: true,
        isHeadless: false,
      });
    });

    test("should initialize with specific mode", async () => {
      vi.mocked(precedenceResolver.resolvePermissionPrecedence).mockReturnValue(
        [],
      );

      const state = await service.initialize({ mode: "plan" });

      expect(state.currentMode).toBe("plan");
      // Plan mode should have mode-specific policies
      expect(state.permissions.policies.length).toBeGreaterThan(0);
      expect(state.permissions.policies).toContainEqual({
        tool: "Write",
        permission: "exclude",
      });
    });
  });

  describe("initializeSync()", () => {
    test("should work synchronously for immediate availability", () => {
      vi.mocked(precedenceResolver.resolvePermissionPrecedence).mockReturnValue(
        [{ tool: "Tool1", permission: "allow" }],
      );

      const state = service.initializeSync({ allow: ["Tool1"] });

      expect(state).toBeDefined();
      expect(state.permissions.policies).toContainEqual({
        tool: "Tool1",
        permission: "allow",
      });
    });

    test("should handle empty overrides", () => {
      vi.mocked(precedenceResolver.resolvePermissionPrecedence).mockReturnValue(
        [{ tool: "*", permission: "ask" }],
      );

      const state = service.initializeSync({
        allow: [],
        ask: [],
        exclude: [],
      });

      expect(state.permissions.policies).toEqual([
        { tool: "*", permission: "ask" },
      ]);
    });
  });

  describe("Mode-specific policies", () => {
    test("should generate plan mode policies", () => {
      const state = service.initializeSync({ mode: "plan" });
      const policies = state.permissions.policies;

      // Should exclude write tools
      expect(policies).toContainEqual({ tool: "Write", permission: "exclude" });
      expect(policies).toContainEqual({ tool: "Edit", permission: "exclude" });

      // Should allow read tools and bash
      expect(policies).toContainEqual({ tool: "Bash", permission: "allow" });
      expect(policies).toContainEqual({ tool: "Read", permission: "allow" });
      expect(policies).toContainEqual({ tool: "Search", permission: "allow" });
      expect(policies).toContainEqual({ tool: "List", permission: "allow" });

      // Plan mode has wildcard allow at the end for MCP and other tools
      expect(policies[policies.length - 1]).toEqual({
        tool: "*",
        permission: "allow",
      });
    });

    test("should generate auto mode policies", () => {
      const state = service.initializeSync({ mode: "auto" });

      expect(state.permissions.policies).toEqual([
        { tool: "*", permission: "allow" },
      ]);
    });

    test("should generate normal mode policies", () => {
      vi.mocked(precedenceResolver.resolvePermissionPrecedence).mockReturnValue(
        [
          { tool: "Tool1", permission: "allow" },
          { tool: "Tool2", permission: "ask" },
        ],
      );

      const state = service.initializeSync({ mode: "normal" });

      // Normal mode should use user configuration
      expect(state.permissions.policies).toEqual([
        { tool: "Tool1", permission: "allow" },
        { tool: "Tool2", permission: "ask" },
      ]);
      expect(state.modePolicyCount).toBe(0);
    });
  });

  describe("switchMode()", () => {
    beforeEach(() => {
      vi.mocked(precedenceResolver.resolvePermissionPrecedence).mockReturnValue(
        [
          { tool: "UserTool1", permission: "allow" },
          { tool: "UserTool2", permission: "exclude" },
        ],
      );
    });

    test("should switch from normal to plan mode", () => {
      service.initializeSync({ mode: "normal" });

      const state = service.switchMode("plan");

      expect(state.currentMode).toBe("plan");
      // Should only have plan mode policies
      expect(state.permissions.policies).toContainEqual({
        tool: "Write",
        permission: "exclude",
      });
      // Should not have user policies
      expect(state.permissions.policies).not.toContainEqual({
        tool: "UserTool1",
        permission: "allow",
      });
    });

    test("should store original policies when leaving normal mode", () => {
      service.initializeSync({ mode: "normal" });
      const originalState = service.getState();

      service.switchMode("plan");
      const planState = service.getState();

      // Should have stored original policies
      expect(planState.originalPolicies).toEqual({
        policies: originalState.permissions.policies,
      });
    });

    test("should restore original policies when switching back to normal", () => {
      // Start in normal with user policies
      service.initializeSync({ mode: "normal" });
      const originalPolicies = service.getState().permissions.policies;

      // Switch to plan
      service.switchMode("plan");

      // Switch back to normal
      const state = service.switchMode("normal");

      // Should restore original user policies
      expect(state.permissions.policies).toEqual(originalPolicies);
    });

    test("should handle multiple mode switches", () => {
      service.initializeSync({ mode: "normal" });

      // Switch through all modes
      service.switchMode("plan");
      expect(service.getCurrentMode()).toBe("plan");

      service.switchMode("auto");
      expect(service.getCurrentMode()).toBe("auto");
      expect(service.getState().permissions.policies).toEqual([
        { tool: "*", permission: "allow" },
      ]);

      service.switchMode("normal");
      expect(service.getCurrentMode()).toBe("normal");
    });
  });

  describe("updatePermissions()", () => {
    test("should replace all policies", () => {
      service.initializeSync();

      const newPolicies: ToolPermissionPolicy[] = [
        { tool: "NewTool1", permission: "allow" },
        { tool: "NewTool2", permission: "ask" },
      ];

      service.updatePermissions(newPolicies);
      const state = service.getState();

      expect(state.permissions.policies).toEqual(newPolicies);
      expect(state.modePolicyCount).toBe(0);
    });
  });

  describe("getPermissions()", () => {
    test("should return current permissions", () => {
      service.initializeSync({ allow: ["TestTool"] });

      const permissions = service.getPermissions();
      const state = service.getState();

      // getState() returns a deep copy, so references won't match
      expect(permissions).toEqual(state.permissions);
      expect(permissions.policies).toEqual(state.permissions.policies);
    });
  });

  describe("getCurrentMode()", () => {
    test("should return current mode", () => {
      service.initializeSync({ mode: "plan" });
      expect(service.getCurrentMode()).toBe("plan");

      service.switchMode("auto");
      expect(service.getCurrentMode()).toBe("auto");
    });
  });

  describe("isReady()", () => {
    test("should always return true (service is always ready)", () => {
      // ToolPermissionService is designed to be always ready since it uses synchronous initialization
      expect(service.isReady()).toBe(true);
    });

    test("should return true after initialization", async () => {
      await service.initialize();
      expect(service.isReady()).toBe(true);
    });
  });

  describe("Event Emission", () => {
    test("should emit stateChanged when switching modes", () => {
      service.initializeSync({ mode: "normal" });

      const listener = vi.fn();
      service.on("stateChanged", listener);

      service.switchMode("plan");

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ currentMode: "plan" }),
        expect.objectContaining({ currentMode: "normal" }),
      );
    });

    test("should emit stateChanged when updating permissions", () => {
      service.initializeSync();

      const listener = vi.fn();
      service.on("stateChanged", listener);

      const newPolicies: ToolPermissionPolicy[] = [
        { tool: "NewTool", permission: "allow" },
      ];
      service.updatePermissions(newPolicies);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          permissions: { policies: newPolicies },
        }),
        expect.any(Object),
      );
    });
  });

  describe("Mode Override Behavior", () => {
    test("plan mode should completely override user policies", () => {
      // Initialize with user policies that would allow writes
      vi.mocked(precedenceResolver.resolvePermissionPrecedence).mockReturnValue(
        [
          { tool: "Write", permission: "allow" },
          { tool: "Edit", permission: "allow" },
        ],
      );

      const state = service.initializeSync({
        mode: "plan",
        allow: ["Write", "Edit"],
      });

      // Plan mode should override and exclude these tools
      expect(state.permissions.policies).toContainEqual({
        tool: "Write",
        permission: "exclude",
      });
      expect(state.permissions.policies).toContainEqual({
        tool: "Edit",
        permission: "exclude",
      });
    });

    test("auto mode should completely override user policies", () => {
      // Initialize with user policies that would exclude tools
      const state = service.initializeSync({
        mode: "auto",
        exclude: ["DangerousTool"],
      });

      // Auto mode should override and allow everything
      expect(state.permissions.policies).toEqual([
        { tool: "*", permission: "allow" },
      ]);
    });
  });

  describe("Headless Mode Behavior", () => {
    test("should pass isHeadless=true to precedence resolver", () => {
      vi.mocked(precedenceResolver.resolvePermissionPrecedence).mockReturnValue(
        [],
      );

      const state = service.initializeSync({ isHeadless: true });

      expect(
        precedenceResolver.resolvePermissionPrecedence,
      ).toHaveBeenCalledWith(expect.objectContaining({ isHeadless: true }));
      expect(state.isHeadless).toBe(true);
    });

    test("should pass isHeadless=false to precedence resolver", () => {
      vi.mocked(precedenceResolver.resolvePermissionPrecedence).mockReturnValue(
        [],
      );

      const state = service.initializeSync({ isHeadless: false });

      expect(
        precedenceResolver.resolvePermissionPrecedence,
      ).toHaveBeenCalledWith(expect.objectContaining({ isHeadless: false }));
      expect(state.isHeadless).toBe(false);
    });

    test("should apply plan mode policies in headless plan mode", () => {
      const state = service.initializeSync({
        isHeadless: true,
        mode: "plan",
      });

      // Plan mode should exclude write tools
      const writeExcludeIndex = state.permissions.policies.findIndex(
        (p) => p.tool === "Write" && p.permission === "exclude",
      );
      expect(writeExcludeIndex).toBeGreaterThanOrEqual(0);

      // Plan mode allows all other tools via wildcard
      expect(state.permissions.policies).toContainEqual({
        tool: "*",
        permission: "allow",
      });
      expect(state.isHeadless).toBe(true);
    });

    test("should apply auto mode policies in headless auto mode", () => {
      const state = service.initializeSync({
        isHeadless: true,
        mode: "auto",
      });

      // Auto mode has wildcard allow
      expect(state.permissions.policies).toContainEqual({
        tool: "*",
        permission: "allow",
      });
      expect(state.isHeadless).toBe(true);
    });

    test("should have modePolicyCount of 0 in normal mode regardless of headless", () => {
      vi.mocked(precedenceResolver.resolvePermissionPrecedence).mockReturnValue(
        [],
      );

      const headlessState = service.initializeSync({ isHeadless: true });
      expect(headlessState.modePolicyCount).toBe(0);

      const nonHeadlessService = new ToolPermissionService();
      const nonHeadlessState = nonHeadlessService.initializeSync({
        isHeadless: false,
      });
      expect(nonHeadlessState.modePolicyCount).toBe(0);
    });
  });

  describe("reloadPermissions", () => {
    test("should reload permissions from files in normal mode", async () => {
      const mockPolicies = [
        { tool: "Edit", permission: "allow" as const },
        { tool: "Write", permission: "ask" as const },
      ];

      // Mock the precedence resolver to return fresh policies
      vi.mocked(precedenceResolver.resolvePermissionPrecedence).mockReturnValue(
        mockPolicies,
      );

      const service = new ToolPermissionService();
      service.initializeSync({ mode: "normal" });

      // Verify initial state
      expect(service.getPermissions().policies).toEqual(mockPolicies);

      // Simulate new policies being added to the file
      const newMockPolicies = [
        ...mockPolicies,
        { tool: "Read", permission: "allow" as const },
      ];
      vi.mocked(precedenceResolver.resolvePermissionPrecedence).mockReturnValue(
        newMockPolicies,
      );

      // Reload permissions
      await service.reloadPermissions();

      // Verify policies were reloaded
      expect(service.getPermissions().policies).toEqual(newMockPolicies);
      expect(
        precedenceResolver.resolvePermissionPrecedence,
      ).toHaveBeenCalledWith({
        personalSettings: true,
        useDefaults: true,
      });
    });

    test("should skip reload in non-normal modes", async () => {
      const service = new ToolPermissionService();
      service.initializeSync({ mode: "plan" });

      const initialPolicies = service.getPermissions().policies;

      // Clear the mock call count
      vi.mocked(precedenceResolver.resolvePermissionPrecedence).mockClear();

      // Try to reload
      await service.reloadPermissions();

      // Verify no reload happened
      expect(service.getPermissions().policies).toEqual(initialPolicies);
      expect(
        precedenceResolver.resolvePermissionPrecedence,
      ).not.toHaveBeenCalled();
    });
  });
});
