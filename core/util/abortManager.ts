export class StreamAbortManager {
  private static instance: StreamAbortManager;
  private controllers: Map<string, AbortController>;

  private constructor() {
    this.controllers = new Map();
  }

  public static getInstance(): StreamAbortManager {
    if (!StreamAbortManager.instance) {
      StreamAbortManager.instance = new StreamAbortManager();
    }
    return StreamAbortManager.instance;
  }

  public get(id: string): AbortController {
    let controller = this.controllers.get(id);
    if (!controller) {
      controller = new AbortController();
      this.controllers.set(id, controller);
    }
    return controller;
  }

  public abort(id: string): void {
    const controller = this.controllers.get(id);
    if (controller) {
      controller.abort();
      this.controllers.delete(id);
    }
  }

  public clear(): void {
    this.controllers.forEach((controller) => controller.abort());
    this.controllers.clear();
  }
}
