import { beforeEach, afterEach, describe, expect, vi, test } from "vitest";

import { ModeService } from "./ModeService.js";

describe("ModeService", () => {
  let modeService: ModeService;

  beforeEach(() => {
    // Reset singleton instance for each test
    (ModeService as any).instance = undefined;
    modeService = ModeService.getInstance();
  });

  afterEach(() => {
    // Clean up singleton instance
    (ModeService as any).instance = undefined;
  });

  describe("State Management", () => {
    test("should initialize with normal mode by default", async () => {
      const state = await modeService.initialize({});

      expect(state).toEqual({
        mode: "normal",
        toolPermissionService: expect.any(Object),
      });
      expect(modeService.getCurrentMode()).toBe("normal");
    });

    test("should convert readonly flag to plan mode", async () => {
      const state = await modeService.initialize({ readonly: true });

      expect(state.mode).toBe("plan");
      expect(modeService.getCurrentMode()).toBe("plan");
    });

    test("should convert auto flag to auto mode", async () => {
      const state = await modeService.initialize({ auto: true });

      expect(state.mode).toBe("auto");
      expect(modeService.getCurrentMode()).toBe("auto");
    });

    test("should initialize tool permission service with flags", async () => {
      const state = await modeService.initialize({
        allow: ["testTool"],
        exclude: ["badTool"],
      });

      const toolPermissionService = state.toolPermissionService;
      expect(toolPermissionService).toBeDefined();
      expect(toolPermissionService.getState()).toBeDefined();
      expect(toolPermissionService.getCurrentMode()).toBe("normal");
    });
  });

  describe("switchMode()", () => {
    beforeEach(async () => {
      await modeService.initialize({});
    });

    test("should switch from normal to plan mode", () => {
      expect(modeService.getCurrentMode()).toBe("normal");

      modeService.switchMode("plan");

      expect(modeService.getCurrentMode()).toBe("plan");
      expect(modeService.getState().mode).toBe("plan");
    });

    test("should switch from plan to auto mode", () => {
      modeService.switchMode("plan");
      expect(modeService.getCurrentMode()).toBe("plan");

      modeService.switchMode("auto");

      expect(modeService.getCurrentMode()).toBe("auto");
      expect(modeService.getState().mode).toBe("auto");
    });

    test("should switch back to normal mode", () => {
      modeService.switchMode("plan");
      modeService.switchMode("normal");

      expect(modeService.getCurrentMode()).toBe("normal");
      expect(modeService.getState().mode).toBe("normal");
    });

    test("should update tool permission service when switching modes", () => {
      const toolPermissionService = modeService.getToolPermissionService();
      const initialState = toolPermissionService.getState();

      modeService.switchMode("auto");
      const newState = toolPermissionService.getState();

      expect(newState.currentMode).toBe("auto");
      expect(newState.permissions.policies.length).toBeGreaterThan(0);
      expect(newState.permissions.policies[0]).toEqual({
        tool: "*",
        permission: "allow",
      });
    });

    test("should handle multiple mode switches correctly", () => {
      // Start in normal
      expect(modeService.getCurrentMode()).toBe("normal");

      // Switch to plan
      modeService.switchMode("plan");
      const planState = modeService.getToolPermissionService().getState();
      expect(planState.permissions.policies).toContainEqual({
        tool: "Write",
        permission: "exclude",
      });

      // Switch to auto
      modeService.switchMode("auto");
      const autoState = modeService.getToolPermissionService().getState();
      expect(autoState.permissions.policies).toHaveLength(1);
      expect(autoState.permissions.policies[0]).toEqual({
        tool: "*",
        permission: "allow",
      });

      // Back to normal
      modeService.switchMode("normal");
      const normalState = modeService.getToolPermissionService().getState();
      expect(normalState.currentMode).toBe("normal");
    });
  });

  describe("getAvailableModes()", () => {
    beforeEach(async () => {
      await modeService.initialize({});
    });

    test("should return all available modes with descriptions", () => {
      const modes = modeService.getAvailableModes();
      expect(modes).toHaveLength(3);

      const modeNames = modes.map((m) => m.mode);
      expect(modeNames).toContain("normal");
      expect(modeNames).toContain("plan");
      expect(modeNames).toContain("auto");

      // Check that all modes have descriptions
      modes.forEach((mode) => {
        expect(mode.description).toBeDefined();
        expect(mode.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Singleton Behavior", () => {
    test("should return the same instance", () => {
      const instance1 = ModeService.getInstance();
      const instance2 = ModeService.getInstance();
      expect(instance1).toBe(instance2);
    });

    test("should maintain state across getInstance calls", async () => {
      const instance1 = ModeService.getInstance();
      await instance1.initialize({});
      instance1.switchMode("plan");

      const instance2 = ModeService.getInstance();
      expect(instance2.getCurrentMode()).toBe("plan");
    });
  });

  describe("isReady()", () => {
    test("should always return true for ModeService", () => {
      // ModeService is always ready since it's a singleton
      expect(modeService.isReady()).toBe(true);
    });
  });

  describe("Event Emission", () => {
    let modeChangeListener: ReturnType<typeof vi.fn>;
    let stateChangeListener: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      await modeService.initialize({});
      modeChangeListener = vi.fn();
      stateChangeListener = vi.fn();
      modeService.on("modeChanged", modeChangeListener);
      modeService.on("stateChanged", stateChangeListener);
    });

    afterEach(() => {
      modeService.off("modeChanged", modeChangeListener);
      modeService.off("stateChanged", stateChangeListener);
    });

    test("should emit modeChanged event when mode switches", () => {
      modeService.switchMode("plan");

      expect(modeChangeListener).toHaveBeenCalledWith("plan", "normal");
      expect(modeChangeListener).toHaveBeenCalledTimes(1);
    });

    test("should emit stateChanged event when mode switches", () => {
      modeService.switchMode("plan");

      expect(stateChangeListener).toHaveBeenCalledWith(
        expect.objectContaining({ mode: "plan" }),
        expect.objectContaining({ mode: "normal" }),
      );
    });

    test("should emit event with correct previous and new modes", () => {
      modeService.switchMode("plan");
      modeChangeListener.mockClear();
      stateChangeListener.mockClear();

      modeService.switchMode("auto");

      expect(modeChangeListener).toHaveBeenCalledWith("auto", "plan");
      expect(modeChangeListener).toHaveBeenCalledTimes(1);
      expect(stateChangeListener).toHaveBeenCalledTimes(1);
    });

    test("should not emit event when switching to same mode", () => {
      modeService.switchMode("plan");
      modeChangeListener.mockClear();
      stateChangeListener.mockClear();

      modeService.switchMode("plan");

      expect(modeChangeListener).not.toHaveBeenCalled();
      // stateChanged might still be called due to setState, but modeChanged should not
    });
  });

  describe("Integration with ToolPermissionService", () => {
    beforeEach(async () => {
      await modeService.initialize({
        allow: ["Read"],
        exclude: ["dangerous_tool"],
      });
    });

    test("should pass initialization args to ToolPermissionService", () => {
      const toolService = modeService.getToolPermissionService();
      const state = toolService.getState();

      // The state should have processed the allow/exclude rules
      expect(state.permissions.policies).toBeDefined();
      expect(state.currentMode).toBe("normal");
    });

    test("should maintain ToolPermissionService reference", () => {
      const toolService1 = modeService.getToolPermissionService();
      const toolService2 = modeService.getToolPermissionService();

      expect(toolService1).toBe(toolService2);
    });
  });
});
