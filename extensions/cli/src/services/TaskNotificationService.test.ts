import { EventEmitter } from "events";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fireNotificationMock: vi.fn(),
}));

vi.mock("../hooks/fireHook.js", () => ({
  fireNotification: mocks.fireNotificationMock,
}));

import { BackgroundJobService } from "./BackgroundJobService.js";
import { TaskNotificationService } from "./TaskNotificationService.js";
import { TaskStateService } from "./TaskStateService.js";

describe("TaskNotificationService", () => {
  beforeEach(() => {
    mocks.fireNotificationMock.mockReset();
  });

  it("records task notifications from task state transitions", async () => {
    const taskStateService = new TaskStateService();
    const backgroundJobService = new BackgroundJobService();
    const service = new TaskNotificationService();

    await Promise.all([
      taskStateService.initialize(),
      service.initialize({
        taskStateService,
        backgroundJobService,
        featureFlagsService: { isEnabled: () => true },
      }),
    ]);

    taskStateService.createTask("Implement task notifications");
    taskStateService.startCurrentTask();
    taskStateService.recordToolCall();
    taskStateService.updateTokens(321);
    taskStateService.completeTask();

    const notifications = service.getRecentNotifications(10);

    expect(notifications.map((notification) => notification.status)).toEqual([
      "completed",
      "running",
      "pending",
    ]);
    expect(notifications[0].kind).toBe("workflow");
    expect(notifications[0].usage).toMatchObject({
      toolUses: 1,
      totalTokens: 321,
    });
    expect(service.formatRecentNotifications()).toContain(
      "Task completed: Implement task notifications",
    );
    expect(mocks.fireNotificationMock).toHaveBeenCalledTimes(3);
  });

  it("stays empty when the feature flag is disabled", async () => {
    const taskStateService = new TaskStateService();
    const service = new TaskNotificationService();

    await Promise.all([
      taskStateService.initialize(),
      service.initialize({
        taskStateService,
        backgroundJobService: new BackgroundJobService(),
        featureFlagsService: { isEnabled: () => false },
      }),
    ]);

    taskStateService.createTask("No notifications");
    taskStateService.startCurrentTask();
    taskStateService.completeTask();

    expect(service.getRecentNotifications()).toEqual([]);
    expect(service.formatRecentNotifications()).toBeNull();
    expect(mocks.fireNotificationMock).not.toHaveBeenCalled();
  });

  it("records background shell job notifications", async () => {
    const backgroundJobService = new BackgroundJobService();
    const service = new TaskNotificationService();

    await service.initialize({
      taskStateService: new TaskStateService(),
      backgroundJobService,
      featureFlagsService: { isEnabled: () => true },
    });

    const job = backgroundJobService.createJob("npm test")!;
    backgroundJobService.completeJob(job.id, 0);

    const notifications = service.getRecentNotifications(10);
    expect(notifications.map((notification) => notification.kind)).toContain(
      "shell",
    );
    expect(notifications.map((notification) => notification.status)).toContain(
      "completed",
    );
    expect(service.formatRecentNotifications()).toContain(
      "Shell job completed: npm test",
    );

    backgroundJobService.cleanup();
  });

  it("records stalled shell job notifications after prolonged silence", async () => {
    vi.useFakeTimers();

    const backgroundJobService = new BackgroundJobService();
    const service = new TaskNotificationService();

    await service.initialize({
      taskStateService: new TaskStateService(),
      backgroundJobService,
      featureFlagsService: { isEnabled: () => true },
    });

    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter & { setEncoding: ReturnType<typeof vi.fn> };
      stderr: EventEmitter & { setEncoding: ReturnType<typeof vi.fn> };
      kill: ReturnType<typeof vi.fn>;
    };
    child.stdout = Object.assign(new EventEmitter(), { setEncoding: vi.fn() });
    child.stderr = Object.assign(new EventEmitter(), { setEncoding: vi.fn() });
    child.kill = vi.fn();

    const job = backgroundJobService.createJobWithProcess(
      "npm run watch",
      child as any,
    );

    expect(job).not.toBeNull();

    vi.advanceTimersByTime(65000);

    const notifications = service.getRecentNotifications(10);
    expect(notifications.map((notification) => notification.status)).toContain(
      "stalled",
    );
    expect(service.formatRecentNotifications()).toContain(
      "Shell job stalled: npm run watch",
    );

    backgroundJobService.cleanup();
    vi.useRealTimers();
  });
});
