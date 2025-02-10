import { CancellationTokenSource } from "vscode";

/**
 * CancellationController is a class that extends CancellationTokenSource and provides an AbortSignal.
 */
export class CancellationController extends CancellationTokenSource {
  constructor(private abortController = new AbortController()) {
    super();
    this.token.onCancellationRequested(() => {
      this.abortController.abort();
    });
  }

  get signal(): AbortSignal {
    return this.abortController.signal;
  }
}
