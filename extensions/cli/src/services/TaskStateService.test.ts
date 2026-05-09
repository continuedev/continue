import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  serviceContainerSet: vi.fn(),
  loggerDebug: vi.fn(),
}));

vi.mock("./ServiceContainer.js", () => ({
  serviceContainer: {
    set: mocks.serviceContainerSet,
  },
}));

vi.mock("../util/logger.js", () => ({
  logger: {
    debug: mocks.loggerDebug,
  },
}));

import { TaskStateService } from "./TaskStateService.js";

describe("TaskStateService", () => {
  let service: TaskStateService;
  let fakeNow: number;

  beforeEach(async () => {
    fakeNow = 1_000;
    vi.spyOn(Date, "now").mockImplementation(() => fakeNow);
    mocks.serviceContainerSet.mockReset();
    mocks.loggerDebug.mockReset();

    service = new TaskStateService();
    await service.initialize();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("tracks task lifecycle details and truncates long descriptions", () => {
    const description = "x".repeat(150);

    const task = service.createTask(description, "agent");

    expect(task.id).toMatch(/^a/);
    expect(task.description).toBe("x".repeat(120));
    expect(service.getCurrentTask()).toMatchObject({
      status: "pending",
      type: "agent",
      toolCallCount: 0,
      tokensUsed: 0,
    });

    fakeNow = 2_000;
    service.startCurrentTask();
    service.recordToolCall();
    service.recordToolCall();
    service.updateTokens(321);

    fakeNow = 4_000;
    service.completeTask();

    const state = service.getState();
    expect(state.currentTask).toBeNull();
    expect(state.sessionTaskCount).toBe(1);
    expect(state.taskHistory).toHaveLength(1);
    expect(state.taskHistory[0]).toMatchObject({
      type: "agent",
      status: "completed",
      description: "x".repeat(120),
      startTime: 1_000,
      endTime: 4_000,
      toolCallCount: 2,
      tokensUsed: 321,
    });
    expect(mocks.serviceContainerSet).toHaveBeenCalled();
  });

  it("resets active task state for a new session", () => {
    service.createTask("Investigate coordinator handoff");

    fakeNow = 2_000;
    service.startCurrentTask();
    service.recordToolCall();

    fakeNow = 3_000;
    service.newSession();

    expect(service.getState()).toMatchObject({
      currentTask: null,
      taskHistory: [],
      sessionTaskCount: 0,
      sessionStartTime: 3_000,
    });
  });

  it("keeps only the most recent history entries and formats status output", () => {
    for (let index = 0; index < 21; index += 1) {
      fakeNow += 1_000;
      service.createTask(`task ${index}`, "chat");
      service.startCurrentTask();
      fakeNow += 1_000;
      service.completeTask();
    }

    const trimmedHistory = service.getState().taskHistory;
    expect(trimmedHistory).toHaveLength(20);
    expect(trimmedHistory[0]?.description).toBe("task 1");
    expect(trimmedHistory.some((task) => task.description === "task 0")).toBe(
      false,
    );

    fakeNow += 1_000;
    service.createTask("Current verification", "skill");
    service.startCurrentTask();
    service.recordToolCall();
    service.updateTokens(900);

    fakeNow += 65_000;
    const formatted = service.formatStatus();

    expect(formatted).toContain("Session: 1m 48s elapsed, 22 tasks");
    expect(formatted).toContain("Current task (");
    expect(formatted).toContain("Status:      ▶ running");
    expect(formatted).toContain("Type:        skill");
    expect(formatted).toContain("Tool calls:  1");
    expect(formatted).toContain("Tokens used: 900");
    expect(formatted).toContain("Recent tasks:");
    expect(formatted).toContain("task 20");
    expect(formatted).not.toContain("task 14");
  });
});
