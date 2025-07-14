import { Session, TaskInfo } from "../..";
import type { FromCoreProtocol, ToCoreProtocol } from "../../protocol";
import type { IMessenger } from "../../protocol/messenger";
import { TaskManager } from "./TaskManager";

const taskManagers = new Map<Session["sessionId"], TaskManager>();

export function getTaskManagerForSession(
  sessionId: Session["sessionId"],
  messenger: IMessenger<ToCoreProtocol, FromCoreProtocol>,
) {
  if (taskManagers.has(sessionId)) {
    return taskManagers.get(sessionId)!;
  }
  const newManager = new TaskManager(messenger);
  taskManagers.set(sessionId, newManager);
  return newManager;
}

export function fetchTaskList(
  sessionId: Session["sessionId"],
  messenger: IMessenger<ToCoreProtocol, FromCoreProtocol>,
) {
  return getTaskManagerForSession(sessionId, messenger).list();
}

export function updateTaskInTaskList(
  sessionId: Session["sessionId"],
  task: Pick<TaskInfo, "id" | "name" | "description">,
  messenger: IMessenger<ToCoreProtocol, FromCoreProtocol>,
) {
  getTaskManagerForSession(sessionId, messenger).update(
    task.id,
    task.name,
    task.description,
  );
}

export function deleteTaskFromTaskList(
  sessionId: Session["sessionId"],
  taskId: TaskInfo["id"],
  messenger: IMessenger<ToCoreProtocol, FromCoreProtocol>,
) {
  getTaskManagerForSession(sessionId, messenger).remove(taskId);
}
