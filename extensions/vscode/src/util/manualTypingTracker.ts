import { ManualTypingStatisticsService } from "core/autocomplete/util/ManualTypingStatisticsService";
import * as vscode from "vscode";

export class ManualTypingTracker {
  private statisticsService: ManualTypingStatisticsService;
  private typeCommandDisposable: vscode.Disposable | undefined;

  constructor() {
    this.statisticsService = ManualTypingStatisticsService.getInstance();
  }

  public initialize(context: vscode.ExtensionContext): void {
    if (this.typeCommandDisposable) return;

    this.typeCommandDisposable = vscode.commands.registerCommand(
      "type",
      (args) => {
        this.handleManualTyping(args);
        return vscode.commands.executeCommand("default:type", args);
      },
    );

    context.subscriptions.push(this.typeCommandDisposable);
  }

  private handleManualTyping(args: any): void {
    if (!this.statisticsService.isEnabled()) return;

    const text = args?.text || "";
    if (!text) return;

    const charactersAdded = text.length;
    const linesAdded = (text.match(/\n/g) || []).length;

    this.statisticsService.trackManualTyping(charactersAdded, linesAdded);
  }

  public getStatistics() {
    return this.statisticsService.getStatistics();
  }

  public resetStatistics(): void {
    this.statisticsService.resetStatistics();
  }

  public dispose(): void {
    this.typeCommandDisposable?.dispose();
    this.statisticsService.dispose();
  }
}
