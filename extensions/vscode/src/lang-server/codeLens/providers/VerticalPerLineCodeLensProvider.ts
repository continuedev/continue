import * as vscode from "vscode";
import { VerticalDiffCodeLens } from "../../../diff/verticalPerLine/manager";
import { getAltOrOption, getMetaKeyLabel } from "../../../util/util";

export class VerticalPerLineCodeLensProvider
  implements vscode.CodeLensProvider
{
  private _eventEmitter: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();

  onDidChangeCodeLenses: vscode.Event<void> = this._eventEmitter.event;

  public refresh(): void {
    this._eventEmitter.fire();
  }

  constructor(
    private readonly editorToVerticalDiffCodeLens: Map<
      string,
      VerticalDiffCodeLens[]
    >,
  ) {}

  public provideCodeLenses(
    document: vscode.TextDocument,
    _: vscode.CancellationToken,
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    const filepath = document.uri.fsPath;
    const blocks = this.editorToVerticalDiffCodeLens.get(filepath);

    if (!blocks) {
      return [];
    }

    const codeLenses: vscode.CodeLens[] = [];

    for (let i = 0; i < blocks.length; i++) {
      const isFirstBlockInMultiBlockDocument =
        codeLenses.length === 0 && blocks.length > 1;

      const block = blocks[i];
      const start = new vscode.Position(block.start, 0);
      const range = new vscode.Range(
        start,
        start.translate(block.numGreen + block.numRed),
      );

      if (isFirstBlockInMultiBlockDocument) {
        codeLenses.push(
          new vscode.CodeLens(range, {
            title: `Accept All (${getMetaKeyLabel()}⇧↩)`,
            command: "continue.acceptDiff",
            arguments: [filepath, i],
          }),
          new vscode.CodeLens(range, {
            title: `Reject All (${getMetaKeyLabel()}⇧⌫)`,
            command: "continue.rejectDiff",
            arguments: [filepath, i],
          }),
        );
      }

      codeLenses.push(
        new vscode.CodeLens(range, {
          title: `Accept${
            codeLenses.length === 2
              ? ` (${getAltOrOption()}${getMetaKeyLabel()}Y)`
              : ""
          }`,
          command: "continue.acceptVerticalDiffBlock",
          arguments: [filepath, i],
        }),
        new vscode.CodeLens(range, {
          title: `Reject${
            codeLenses.length === 2
              ? ` (${getAltOrOption()}${getMetaKeyLabel()}N)`
              : ""
          }`,
          command: "continue.rejectVerticalDiffBlock",
          arguments: [filepath, i],
        }),
      );

      if (codeLenses.length === 4) {
        codeLenses.push(
          new vscode.CodeLens(range, {
            title: `${getMetaKeyLabel()}I to add instructions`,
            command: "",
          }),
        );
      }
    }

    return codeLenses;
  }
}
