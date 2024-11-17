import { IndexingStatusMap, IndexingStatusUpdate } from "..";
import { FromCoreProtocol, ToCoreProtocol } from "../protocol";
import { IMessenger } from "../util/messenger";

/*
    Any service that sends indexing updates can use an instance of this class
    1. Pass indexingManager to the service
    2. Register the service with the manager using `registerService`
       E.g. docs uses startUrl as id
    3. 
*/
export class IndexingStatusManager {
  private readonly messenger: IMessenger<ToCoreProtocol, FromCoreProtocol>;
  readonly statuses: IndexingStatusMap = new Map();
  private readonly reindexTypeFunctions: Map<
    string,
    (id: string) => Promise<void>
  > = new Map();

  constructor(messenger: IMessenger<ToCoreProtocol, FromCoreProtocol>) {
    this.messenger = messenger;
  }

  // Services that use an instance of this class should add their reindex functions here
  registerService(type: string, fn: (id: string) => Promise<void>) {
    this.reindexTypeFunctions.set(type, fn);
    this.statuses.set(type, new Map());
  }

  reindex(type: string, id: string) {
    const byType = this.statuses.get(type);
    const reindexFn = this.reindexTypeFunctions.get(type);

    if (byType && reindexFn) {
      const status = byType.get(id);
      if (status) {
        if (status.status === "deleted") {
          throw new Error(
            "Cannot reindex a deleted item, shouldn't ever happen",
          );
        }
        void reindexFn(id);
      }
    }
  }

  handleUpdate(status: IndexingStatusUpdate) {
    const byType = this.statuses.get(status.type);
    if (byType) {
      byType.set(status.id, status);
      this.messenger.send("indexing/statusUpdate", status);
    }
  }

  delete(type: string, id: string) {
    const byType = this.statuses.get(type);
    if (byType) {
      const status = byType.get(id);
      if (status) {
        this.handleUpdate({ ...status, status: "deleted" });
      }
    }
  }

  abort(type: string, id: string) {
    const byType = this.statuses.get(type);
    if (byType) {
      const status = byType.get(id);
      if (status) {
        this.handleUpdate({ ...status, status: "aborted" });
      }
    }
  }

  isAborted(type: string, id: string) {
    const byType = this.statuses.get(type);
    if (byType) {
      const status = byType.get(id);
      if (status) {
        return status.status === "aborted";
      }
    }
  }

  setPaused(type: string, id: string, pause: boolean) {
    const byType = this.statuses.get(type);
    if (byType) {
      const status = byType.get(id);
      if (status) {
        this.handleUpdate({ ...status, status: pause ? "paused" : "indexing" });
      }
    }
  }

  isPaused(type: string, id: string) {
    const byType = this.statuses.get(type);
    if (byType) {
      const status = byType.get(id);
      if (status) {
        return status.status === "paused";
      }
    }
  }
}
