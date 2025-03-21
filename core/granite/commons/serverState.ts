import { ServerStatus } from "./statuses";

export interface ServerState {
  status: ServerStatus;
  version: string | undefined;
}
