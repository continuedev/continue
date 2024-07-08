import * as vscode from "vscode";

// Because we have to hide and show the input box again to allow history, this class can act like a more contiguous input box.
export default class InputBoxWithHistory implements vscode.Disposable {
  private static MaxSize = 50;
  private static HistoryKey = "quickEditHistory";
  private currentIndex: number;
  private history: string[] = [];

  private cancellationReason: "up" | "down" | undefined = undefined;
  private readonly completionEventEmitter = new vscode.EventEmitter<
    string | undefined
  >();
  private currentInputBoxCancellationTokenSource:
    | vscode.CancellationTokenSource
    | undefined = undefined;

  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly historyUpEvent: vscode.Event<void>,
    private readonly historyDownEvent: vscode.Event<void>,
    private readonly options: vscode.InputBoxOptions,
  ) {
    this.history = this.context.globalState.get(
      InputBoxWithHistory.HistoryKey,
      [],
    );
    this.currentIndex = this.history.length;

    this.disposables.push(
      this.historyUpEvent(() => {
        const value = this.up();
        this.cancellationReason = "up";

        if (typeof value === "undefined") {
          return;
        }
        this._displayInputBox(value);
      }),
    );
    this.disposables.push(
      this.historyDownEvent(() => {
        const value = this.down();
        this.cancellationReason = "down";

        if (typeof value === "undefined") {
          return;
        }
        this._displayInputBox(value);
      }),
    );
  }

  dispose() {
    if (this.currentInputBoxCancellationTokenSource) {
      this.currentInputBoxCancellationTokenSource.dispose();
    }
    this.completionEventEmitter.dispose();
    this.disposables.forEach((disposable) => disposable.dispose());
    vscode.commands.executeCommand(
      "setContext",
      "continue.quickEditHistoryFocused",
      false,
    );
  }

  appendToHistory(item: string) {
    let history = this.history;
    // Remove duplicate if exists
    if (history[history.length - 1] === item) {
      history = history.slice(0, -1);
    }

    // Add new item
    history.push(item);

    // Truncate if over max size
    if (history.length > InputBoxWithHistory.MaxSize) {
      history = history.slice(-InputBoxWithHistory.MaxSize);
    }

    this.context.globalState.update(InputBoxWithHistory.HistoryKey, history);
  }

  up(): string | undefined {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      return this.history[this.currentIndex];
    }
    return undefined;
  }

  down(): string | undefined {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      return this.history[this.currentIndex];
    } else if (this.currentIndex === this.history.length - 1) {
      this.currentIndex++;
      return "";
    }
    return undefined;
  }

  private _displayInputBox(value?: string) {
    if (this.currentInputBoxCancellationTokenSource) {
      this.currentInputBoxCancellationTokenSource.cancel();
    }

    this.currentInputBoxCancellationTokenSource =
      new vscode.CancellationTokenSource();
    this.currentInputBoxCancellationTokenSource.token.onCancellationRequested(
      () => {
        // Up/down will cancel the input box, but we don't want that to trigger everything to be disposed
        if (
          this.cancellationReason === "up" ||
          this.cancellationReason === "down"
        ) {
          return;
        }
        this.completionEventEmitter.fire(undefined);
      },
    );

    const options = {
      ...this.options,
    };
    if (value) {
      options.value = value;
    }
    vscode.window
      .showInputBox(options, this.currentInputBoxCancellationTokenSource.token)
      .then((input) => {
        if (
          (!input && this.cancellationReason === "up") ||
          this.cancellationReason === "down"
        ) {
          return;
        }
        this.completionEventEmitter.fire(input);
      });

    setTimeout(() => {
      this.cancellationReason = undefined;
    }, 100);
  }

  async getInput(): Promise<string | undefined> {
    try {
      vscode.commands.executeCommand(
        "setContext",
        "continue.quickEditHistoryFocused",
        true,
      );

      return await new Promise((resolve, reject) => {
        const completionDisposable = this.completionEventEmitter.event(
          (input) => {
            resolve(input);
            completionDisposable.dispose();
            if (input) {
              this.appendToHistory(input);
            }
            this.dispose();
          },
        );

        this._displayInputBox();
      });
    } catch (e) {
      console.error(e);
    } finally {
      vscode.commands.executeCommand(
        "setContext",
        "continue.quickEditHistoryFocused",
        false,
      );
    }
  }
}
