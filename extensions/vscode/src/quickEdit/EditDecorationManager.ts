import vscode from "vscode";
class EditDecorationManager {
  private _lastEditor: vscode.TextEditor | undefined;
  private decorationType: vscode.TextEditorDecorationType;
  private activeRangesMap: Map<string, vscode.Range> = new Map(); // Store unique active ranges

  constructor(context: vscode.ExtensionContext) {
    this.decorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor(
        // "editor.selectionHighlightBackground" requires partial transparency.
        // This ensures the highlight does not completely obscure the selection,
        // making it useful for repurposing here.
        "editor.selectionHighlightBackground",
      ),
      isWholeLine: true,
    });
  }

  private updateInEditMode(inEditMode: boolean) {
    vscode.commands.executeCommand(
      "setContext",
      "continue.inEditMode",
      inEditMode,
    );
  }

  // Converts each range to a unique string for storing in the map
  private rangeToString(range: vscode.Range): string {
    return `(${range.start.line},${range.start.character})-(${range.end.line},${range.end.character})`;
  }

  // Checks if two ranges are adjacent or overlapping
  private rangesCoincide(range1: vscode.Range, range2: vscode.Range): boolean {
    return range1.start.isEqual(range2.start)
    || range1.end.isEqual(range2.start)
    || range2.end.isEqual(range1.start)
    || !!range1.intersection(range2);
  }

  // Merges new range with existing ranges in the map
  private mergeNewRange(newRange: vscode.Range): void {
    let mergedRange = newRange;
    const rangesToPrune: string[] = [];

    for (const [key, existingRange] of this.activeRangesMap.entries()) {
      if (!this.rangesCoincide(mergedRange, existingRange)) continue; 
      mergedRange = mergedRange.union(existingRange);
      rangesToPrune.push(key);
    }

    for (const key of rangesToPrune) this.activeRangesMap.delete(key);
    this.activeRangesMap.set(this.rangeToString(mergedRange), mergedRange);
  }

  // Adds a new decoration to the editor and merges it with existing ranges
  addDecorations(editor: vscode.TextEditor, ranges: vscode.Range[]): void {
    if (this._lastEditor?.document !== editor.document) {
      this.clear(); // Clear previous decorations if editor has changed
    }
    this._lastEditor = editor;

    for (const range of ranges) this.mergeNewRange(range);

    const activeRanges = Array.from(this.activeRangesMap.values());
    if (activeRanges.length === 0) return; // No ranges to highlight

    // Update active ranges and apply decorations
    editor.setDecorations(this.decorationType, activeRanges);
    this.updateInEditMode(true);
  }

  clear() {
    if (this._lastEditor) {
      this._lastEditor.setDecorations(this.decorationType, []);
      this.activeRangesMap.clear();
      this._lastEditor = undefined;
      this.updateInEditMode(false);
    }
  }
}
export default EditDecorationManager;
