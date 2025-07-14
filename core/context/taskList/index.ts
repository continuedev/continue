import { Session } from "../..";
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
