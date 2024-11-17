import { IndexIdentifier, IndexingStatusMap, IndexingStatusUpdate } from "..";
import { FromCoreProtocol, ToCoreProtocol } from "../protocol";
import { IMessenger } from "../util/messenger";

/*
    Any service that sends indexing updates can use an instance of this class
    1. Pass indexingManager to the service
    2. Register the service with the manager using `registerService`
       E.g. docs uses startUrl as id
    3. Rules of engagement:
        - service is responsible for checking corrupted indexes - don't check paused or deleted
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

  private static instance?: IndexingStatusManager;
  static createSingleton(
    messenger: IMessenger<ToCoreProtocol, FromCoreProtocol>,
  ) {
    const instance = new IndexingStatusManager(messenger);
    IndexingStatusManager.instance = instance;
    return instance;
  }

  static getSingleton() {
    return IndexingStatusManager.instance;
  }

  // Services that use an instance of this class should add their reindex functions here
  registerService(type: string, fn: (id: string) => Promise<void>) {
    this.reindexTypeFunctions.set(type, fn);
    this.statuses.set(type, new Map());
  }

  reindex({ type, id }: IndexIdentifier) {
    const reindexFn = this.reindexTypeFunctions.get(type);
    if (reindexFn) {
      void reindexFn(id);
    }
  }

  handleUpdate(status: IndexingStatusUpdate) {
    const byType = this.statuses.get(status.type);
    if (byType) {
      byType.set(status.id, status);
      this.messenger.send("indexing/statusUpdate", status);
    }
  }

  delete({ type, id }: IndexIdentifier) {
    const status = this.statuses.get(type)?.get(id);
    if (status) {
      this.handleUpdate({ ...status, status: "deleted" });
    }
  }

  abort({ type, id }: IndexIdentifier) {
    const status = this.statuses.get(type)?.get(id);
    if (status) {
      this.handleUpdate({ ...status, status: "aborted" });
    }
  }

  isAborted({ type, id }: IndexIdentifier) {
    const status = this.statuses.get(type)?.get(id);
    if (status) {
      return status.status === "aborted";
    }
  }

  setPaused({ type, id }: IndexIdentifier, pause: boolean) {
    const status = this.statuses.get(type)?.get(id);
    if (status) {
      this.handleUpdate({ ...status, status: pause ? "paused" : "indexing" });
    }
  }

  isPaused({ type, id }: IndexIdentifier) {
    const status = this.statuses.get(type)?.get(id);
    if (status) {
      return status.status === "paused";
    }
  }
}
