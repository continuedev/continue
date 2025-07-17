export class MessageAbortManager {
  private static instance: MessageAbortManager;
  private messageAbortControllers = new Map<string, AbortController>();

  private constructor() {}

  public static getInstance(): MessageAbortManager {
    if (!this.instance) this.instance = new MessageAbortManager();
    return this.instance;
  }

  private addMessageAbortController(id: string): AbortController {
    const controller = new AbortController();
    this.messageAbortControllers.set(id, controller);
    controller.signal.addEventListener("abort", () => {
      this.messageAbortControllers.delete(id);
    });
    return controller;
  }

  public abortById(id: string) {
    this.messageAbortControllers.get(id)?.abort();
  }

  /**
   * Wraps async task execution with automatic AbortController cleanup.
   */
  public runWithAbortController<T extends Promise<any> | AsyncGenerator<any>>(
    id: string,
    task: (controller: AbortController) => T,
  ): T {
    const controller = this.addMessageAbortController(id);
    const cleanup = () => this.abortById(id);

    try {
      const result = task(controller);

      if (result instanceof Promise) {
        return result.finally(cleanup) as T;
      }

      // AsyncGenerator handling (intentionally skipping return/throw as caller only consumes via next())
      return (async function* () {
        try {
          yield* result as AsyncGenerator<any>;
        } finally {
          cleanup();
        }
      })() as T;
    } catch (error) {
      cleanup();
      throw error;
    }
  }
}

export const messageAbortManager = MessageAbortManager.getInstance();
