export class ApplyAbortManager {
  private static instance: ApplyAbortManager;
  private controllers: Map<string, AbortController>;

  private constructor() {
    this.controllers = new Map();
  }

  public static getInstance(): ApplyAbortManager {
    if (!ApplyAbortManager.instance) {
      ApplyAbortManager.instance = new ApplyAbortManager();
    }
    return ApplyAbortManager.instance;
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
