import type {
  TaskNotification,
  TaskNotificationKind,
  TaskNotificationStatus,
} from "core/agent/contracts/index.js";

import { fireNotification } from "../hooks/fireHook.js";
import { logger } from "../util/logger.js";

import {
  BackgroundJobChangeEvent,
  BackgroundJobService,
} from "./BackgroundJobService.js";
import { BaseService, ServiceWithDependencies } from "./BaseService.js";
import type { FeatureFlagsService } from "./FeatureFlagsService.js";
import { serviceContainer } from "./ServiceContainer.js";
import { TaskRecord, TaskStateService } from "./TaskStateService.js";
import { SERVICE_NAMES } from "./types.js";

export interface TaskNotificationRecord extends TaskNotification {
  createdAt: number;
}

export interface TaskNotificationServiceState {
  enabled: boolean;
  notifications: TaskNotificationRecord[];
  lastUpdated: number | null;
}

interface InitializeTaskNotificationServiceOptions {
  taskStateService?: TaskStateService;
  backgroundJobService?: BackgroundJobService;
  featureFlagsService?: Pick<FeatureFlagsService, "isEnabled">;
}

const MAX_NOTIFICATIONS = 50;

function mapTaskKind(type: TaskRecord["type"]): TaskNotificationKind {
  switch (type) {
    case "agent":
    case "skill":
      return "subagent";
    case "compact":
      return "compact";
    case "chat":
    default:
      return "workflow";
  }
}

function mapBackgroundJobStatus(
  event: BackgroundJobChangeEvent,
): TaskNotificationStatus {
  if (event.reason === "stalled") {
    return "stalled";
  }

  switch (event.job.status) {
    case "cancelled":
      return "killed";
    case "pending":
    case "running":
    case "completed":
    case "failed":
      return event.job.status;
    default:
      return "stalled";
  }
}

function summarizeTask(record: TaskRecord): string {
  switch (record.status) {
    case "pending":
      return `Task queued: ${record.description}`;
    case "running":
      return `Task running: ${record.description}`;
    case "completed":
      return `Task completed: ${record.description}`;
    case "failed":
      return `Task failed: ${record.description}`;
    case "killed":
      return `Task killed: ${record.description}`;
  }
}

function summarizeShellJob(event: BackgroundJobChangeEvent): string {
  const command =
    event.job.command.length > 72
      ? `${event.job.command.slice(0, 72)}...`
      : event.job.command;

  if (event.reason === "stalled") {
    return `Shell job stalled: ${command}`;
  }

  switch (event.job.status) {
    case "pending":
      return `Shell job queued: ${command}`;
    case "running":
      return `Shell job running: ${command}`;
    case "completed":
      return `Shell job completed: ${command}`;
    case "failed":
      return `Shell job failed: ${command}`;
    case "cancelled":
      return `Shell job killed: ${command}`;
  }
}

export class TaskNotificationService
  extends BaseService<TaskNotificationServiceState>
  implements ServiceWithDependencies
{
  private notificationKeys = new Set<string>();
  private detachHandlers: Array<() => void> = [];

  constructor() {
    super("TaskNotificationService", {
      enabled: false,
      notifications: [],
      lastUpdated: null,
    });
  }

  protected override setState(
    newState: Partial<TaskNotificationServiceState>,
  ): void {
    super.setState(newState);
    serviceContainer.set(SERVICE_NAMES.TASK_NOTIFICATIONS, this.currentState);
  }

  getDependencies(): string[] {
    return [SERVICE_NAMES.FEATURE_FLAGS, SERVICE_NAMES.TASK_STATE];
  }

  async doInitialize(
    args?: InitializeTaskNotificationServiceOptions,
  ): Promise<TaskNotificationServiceState> {
    this.detachAllHandlers();

    const enabled =
      args?.featureFlagsService?.isEnabled("TASK_NOTIFICATIONS") ?? false;

    this.notificationKeys.clear();
    this.setState({
      enabled,
      notifications: [],
      lastUpdated: null,
    });

    if (!enabled) {
      return this.currentState;
    }

    if (args?.taskStateService) {
      this.attachTaskStateService(args.taskStateService);
    }

    if (args?.backgroundJobService) {
      this.attachBackgroundJobService(args.backgroundJobService);
    }

    return this.currentState;
  }

  override async cleanup(): Promise<void> {
    this.detachAllHandlers();
    this.notificationKeys.clear();
    await super.cleanup();
  }

  getRecentNotifications(limit = 5): TaskNotificationRecord[] {
    return this.currentState.notifications.slice(-limit).reverse();
  }

  formatRecentNotifications(limit = 5): string | null {
    if (
      !this.currentState.enabled ||
      this.currentState.notifications.length === 0
    ) {
      return null;
    }

    const lines = ["Task notifications:"];
    for (const notification of this.getRecentNotifications(limit)) {
      const status = notification.status.padEnd(9);
      const usageParts = [];
      if (notification.usage?.durationMs) {
        usageParts.push(`${Math.round(notification.usage.durationMs / 1000)}s`);
      }
      if (notification.usage?.toolUses) {
        usageParts.push(`${notification.usage.toolUses} tools`);
      }
      if (notification.usage?.totalTokens) {
        usageParts.push(
          `${notification.usage.totalTokens.toLocaleString()} tok`,
        );
      }
      const usage = usageParts.length > 0 ? ` (${usageParts.join(", ")})` : "";
      lines.push(`  ${status} ${notification.summary}${usage}`);
    }

    return lines.join("\n");
  }

  private attachTaskStateService(taskStateService: TaskStateService): void {
    const onStateChanged = (
      nextState: ReturnType<TaskStateService["getState"]>,
      previousState: ReturnType<TaskStateService["getState"]>,
    ) => {
      if (!this.currentState.enabled) {
        return;
      }

      const currentTask = nextState.currentTask;
      const previousTask = previousState.currentTask;

      if (
        currentTask &&
        (!previousTask ||
          previousTask.id !== currentTask.id ||
          previousTask.status !== currentTask.status)
      ) {
        void this.recordNotification(this.mapTaskRecord(currentTask));
      }

      if (nextState.taskHistory.length > previousState.taskHistory.length) {
        for (const task of nextState.taskHistory.slice(
          previousState.taskHistory.length,
        )) {
          void this.recordNotification(this.mapTaskRecord(task));
        }
      }
    };

    taskStateService.on("stateChanged", onStateChanged);
    this.detachHandlers.push(() =>
      taskStateService.off("stateChanged", onStateChanged),
    );
  }

  private attachBackgroundJobService(
    backgroundJobService: BackgroundJobService,
  ): void {
    const onJobChanged = (event: BackgroundJobChangeEvent) => {
      if (!this.currentState.enabled) {
        return;
      }
      void this.recordNotification(this.mapBackgroundJob(event));
    };

    backgroundJobService.on("jobChanged", onJobChanged);
    this.detachHandlers.push(() =>
      backgroundJobService.off("jobChanged", onJobChanged),
    );
  }

  private detachAllHandlers(): void {
    for (const detach of this.detachHandlers) {
      detach();
    }
    this.detachHandlers = [];
  }

  private mapTaskRecord(record: TaskRecord): TaskNotificationRecord {
    return {
      id: record.id,
      status: record.status,
      kind: mapTaskKind(record.type),
      summary: summarizeTask(record),
      description: record.description,
      createdAt: Date.now(),
      usage: {
        durationMs:
          record.endTime !== undefined
            ? record.endTime - record.startTime
            : undefined,
        toolUses: record.toolCallCount || undefined,
        totalTokens: record.tokensUsed || undefined,
      },
      metadata: {
        source: "taskState",
        taskType: record.type,
      },
    };
  }

  private mapBackgroundJob(
    event: BackgroundJobChangeEvent,
  ): TaskNotificationRecord {
    return {
      id: event.job.id,
      status: mapBackgroundJobStatus(event),
      kind: "shell",
      summary: summarizeShellJob(event),
      description: event.job.command,
      createdAt: Date.now(),
      usage: {
        durationMs: event.job.endTime
          ? event.job.endTime.getTime() - event.job.startTime.getTime()
          : undefined,
      },
      metadata: {
        source: "backgroundJob",
        exitCode: event.job.exitCode,
        reason: event.reason,
      },
    };
  }

  private async recordNotification(
    notification: TaskNotificationRecord,
  ): Promise<void> {
    const key =
      notification.status === "stalled"
        ? `${notification.kind}:${notification.id}:${notification.status}:${notification.createdAt}`
        : `${notification.kind}:${notification.id}:${notification.status}`;
    if (this.notificationKeys.has(key)) {
      return;
    }

    this.notificationKeys.add(key);
    const notifications = [
      ...this.currentState.notifications,
      notification,
    ].slice(-MAX_NOTIFICATIONS);

    this.setState({
      notifications,
      lastUpdated: notification.createdAt,
    });

    try {
      await fireNotification(
        notification.summary,
        `task:${notification.status}`,
      );
    } catch (error) {
      logger.debug(
        "TaskNotificationService: failed to fire hook notification",
        {
          error: String(error),
        },
      );
    }
  }
}
