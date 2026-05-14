# The Diff Mechanism

This document explains how Continue computes diffs from LLM output and applies them to a file in the editor, from the shared data type through to the visual Accept/Reject UI.

---

## The shared currency: `DiffLine`

Everything in the diff pipeline passes `DiffLine` values (`core/index.d.ts:762`):

```ts
export type DiffType = "new" | "old" | "same";

export interface DiffLine {
  type: DiffType;
  line: string;
}
```

Every line of the file ends up classified as one of:

- `"same"` — line is unchanged
- `"old"` — line exists in the original file but not in the new version (to be removed)
- `"new"` — line exists in the new version but not in the original (to be added)

This is the only thing that flows between the `core/` layer and the IDE extension layer.

---

## Phase 1 — Producing `DiffLine` entries from LLM output: `streamDiff()`

**Source:** `core/diff/streamDiff.ts:14`

`streamDiff(oldLines: string[], newLines: LineStream)` receives:

- `oldLines` — the original file content split into lines
- `newLines` — an `AsyncGenerator<string>` of lines arriving from the LLM

It processes the LLM output line by line as it arrives, without waiting for the full response, and emits `DiffLine` entries immediately. The algorithm is a greedy streaming matcher:

For each incoming new line it calls `matchLine()` to search for a match in the remaining old lines:

```ts
// streamDiff.ts:27
const { matchIndex, isPerfectMatch, newLine } = matchLine(
  newLineResult.value,
  oldLinesCopy,
  seenIndentationMistake,
);
```

Based on the result:

| `matchIndex` | `isPerfectMatch` | Action                                                                                        |
| ------------ | ---------------- | --------------------------------------------------------------------------------------------- |
| `-1`         | —                | Emit `{ type: "new", line }` — no match, it's a new line                                      |
| `> 0`        | any              | Emit `{ type: "old" }` for each skipped old line before the match, then process the match     |
| `0`          | `true`           | Emit `{ type: "same", line }` — perfect match at the front                                    |
| `0`          | `false`          | Emit `{ type: "old", line }` then `{ type: "new", line }` — fuzzy match, treat as replacement |

When the LLM output ends before the old lines are exhausted, the remaining old lines are emitted as `"old"`. When the old lines are exhausted before the LLM output ends, the remaining new lines are emitted as `"new"`.

### Fuzzy line matching: `matchLine()`

**Source:** `core/diff/util.ts:48`

`matchLine()` searches the remaining old lines for the best match for a new line. It uses Levenshtein edit distance (via the `fastest-levenshtein` package):

```ts
// util.ts:31
const d = distance(lineA, lineB);
return (
  (d / Math.max(lineA.length, lineB.length) <=
    Math.max(0, 0.48 - linesBetween * 0.06) ||
    lineA.trim() === lineB.trim()) &&
  lineA.trim() !== ""
);
```

The tolerance threshold decreases the further away the candidate is (`0.06` per skipped line), so a fuzzy match must be very close if it is further down the file. Closing bracket lines (`}`, `});`, `})`) are only matched if they are within 4 lines ahead, to avoid false matches on common structural tokens.

If the match is imperfect but the trimmed content is identical (only indentation differs), `matchLine()` returns the old line's indentation as the corrected new line — this is the indentation auto-correction feature.

---

## Phase 2 — Streaming diffs into the editor: `VerticalDiffHandler.run()`

**Source:** `extensions/vscode/src/diff/vertical/handler.ts:188`

`VerticalDiffManager.streamDiffLines()` creates a `VerticalDiffHandler` and calls `handler.run(diffStream)`, which iterates the `AsyncGenerator<DiffLine>` as it arrives:

```ts
// handler.ts:195
for await (const diffLine of diffLineGenerator) {
  if (this.isCancelled) return;
  diffLines.push(diffLine);
  await this.queueDiffLine(diffLine);
}
```

### The edit queue

Direct VS Code document edits must happen sequentially. `queueDiffLine()` (`handler.ts:159`) uses a `_queueLock` flag and a `_diffLinesQueue` array to serialize edits:

- If the editor is not the currently active editor, the line is buffered and processing pauses — it will resume when the user switches back to the file (handled by the `onDidChangeActiveTextEditor` listener set up in the constructor)
- Only one `_handleDiffLine()` call runs at a time

### Per-line editor actions: `_handleDiffLine()`

**Source:** `handler.ts:565`

```ts
case "same":
  await this.insertDeletionBuffer();   // flush any pending deletions
  this.incrementCurrentLineIndex();    // advance the cursor
  break;

case "old":
  this.deletionBuffer.push(diffLine.line);   // hold the text
  await this.deleteLinesAt(this.currentLineIndex);  // delete from document now
  break;

case "new":
  await this.insertLineAboveIndex(this.currentLineIndex, diffLine.line);
  this.incrementCurrentLineIndex();
  this.insertedInCurrentBlock++;
  break;
```

### The deletion buffer

`"old"` lines are not immediately shown as red strikethroughs — they are first removed from the document and their text is saved in `deletionBuffer`. When the next `"same"` (or end of stream) arrives, `insertDeletionBuffer()` (`handler.ts:419`) is called:

1. It inserts blank placeholder lines above the current position to make room
2. It calls `removedLineDecorations.addLines()` to render those placeholders as red strikethrough decorations displaying the original text
3. It records the block boundaries in `editorToVerticalDiffCodeLens` for the Accept/Reject CodeLens

This means during streaming, the document never shows the old lines — they are deleted immediately and their visual representation is pure decoration. The green lines are actual inserted document content.

### Progress indicator

While streaming, `incrementCurrentLineIndex()` calls `updateIndexLineDecorations()` (`handler.ts:534`) which applies two decorations:

- `indexDecorationType` — highlights the current line being processed
- `belowIndexDecorationType` — lightly highlights all remaining un-processed lines below

These are cleared when streaming finishes.

---

## Phase 3 — Correction with Myers diff: `reapplyWithMyersDiff()`

**Source:** `handler.ts:324`

The streaming phase produces a visually approximate diff. The greedy `streamDiff` matcher can make locally sensible decisions that turn out to be globally suboptimal (e.g. matching a line early and leaving orphaned old lines). Once all `DiffLine` entries have arrived, `run()` calls `reapplyWithMyersDiff(diffLines)`:

1. **Reject the streaming result** — iterate all current CodeLens blocks in reverse and call `acceptRejectBlock(false, ...)` on each, which removes inserted green lines and re-inserts the deleted red lines, restoring the document to its original content.

2. **Rewrite the document in one edit** — build the final content by mapping `myersDiffs`:

```ts
// handler.ts:370
const replaceContent = myersDiffs
  .map((diff) => (diff.type === "old" ? "" : diff.line))
  .join("\n");

await this.editor.edit((editBuilder) => {
  editBuilder.replace(this.range, replaceContent);
});
```

`"old"` lines are mapped to `""` (they are dropped from the content), while `"new"` and `"same"` lines are kept. This writes the fully-merged new content into the document in a single atomic edit.

3. **Re-apply decorations** — iterate the `myersDiffs` array and:
   - `"old"` lines: register with `removedLineDecorations` (red strikethrough)
   - `"new"` lines: register with `addedLineDecorations` (green highlight)
   - `"same"` after a block: record a `VerticalDiffCodeLens` entry for the Accept/Reject buttons

This produces the clean, final layout the user sees.

### Myers diff: `myersDiff()`

**Source:** `core/diff/myers.ts:29`

`myersDiff()` wraps the npm `diff` package's `diffLines()` function. It converts the result to `DiffLine[]` and adds two post-processing passes:

- Consecutive `old`/`new` pairs where the trimmed content is identical are collapsed to `"same"` (indentation-only changes are not shown as diffs)
- Trailing empty `"old"` lines are removed

Myers diff is also used directly for the instant-apply path (`VerticalDiffManager.instantApplyDiff()`) and for the non-streaming fast-model path in `handleNonInstantDiff()`.

---

## Phase 4 — Accept / Reject

**Source:** `handler.ts:234`, `manager.ts:159`

The CodeLens provider reads `editorToVerticalDiffCodeLens` — a `Map<fileUri, VerticalDiffCodeLens[]>` where each entry records `{ start, numRed, numGreen }` for one diff block. The provider renders "Accept" and "Reject" links above each block.

`acceptRejectBlock(accept, startLine, numGreen, numRed)`:

- **Accept:** Delete the `numRed` red decoration lines (placeholder rows) from the document. Keep the `numGreen` green lines — they are already real document content. Clear the green decoration.
- **Reject:** Delete the `numGreen` green inserted lines from the document. Re-insert the `numRed` original lines above the start position. Clear both decorations.

After each block is accepted or rejected, all decoration positions and CodeLens entries below that block are shifted up or down by the net line delta (`-(accept ? numRed : numGreen)`).

When the last block is resolved, `onStatusUpdate("closed", ...)` is called, which sends `updateApplyState` to the GUI, resetting the Apply button.

---

## Data flow summary

```
LLM output (line stream)
    │
    ▼
streamDiff()                      core/diff/streamDiff.ts
  matchLine() fuzzy matching      core/diff/util.ts
    │
    ▼  AsyncGenerator<DiffLine>
VerticalDiffManager.streamDiffLines()   extensions/vscode/src/diff/vertical/manager.ts
    │  creates VerticalDiffHandler, calls handler.run()
    ▼
VerticalDiffHandler.run()               handler.ts:188
  queueDiffLine() → _handleDiffLine()   handler.ts:159, 565
    "old"  → deleteLinesAt() + deletionBuffer
    "new"  → insertLineAboveIndex() + green decoration
    "same" → insertDeletionBuffer() + red decorations
    │  streaming complete
    ▼
reapplyWithMyersDiff()                  handler.ts:324
  myersDiff()                           core/diff/myers.ts
  editor.edit(replace entire range)
  re-apply red/green decorations
  build CodeLens blocks
    │
    ▼
User sees Accept / Reject blocks
  acceptRejectBlock()                   handler.ts:234
  → document write or restore
  → updateApplyState("closed") → GUI resets Apply button
```

---

## Key source locations

| File                                                 | Relevance                                                |
| ---------------------------------------------------- | -------------------------------------------------------- |
| `core/index.d.ts:756`                                | `DiffType` and `DiffLine` type definitions               |
| `core/diff/streamDiff.ts:14`                         | `streamDiff()` — streaming fuzzy diff against LLM output |
| `core/diff/util.ts:48`                               | `matchLine()` — Levenshtein-based fuzzy line matching    |
| `core/diff/myers.ts:29`                              | `myersDiff()` — deterministic full diff using npm `diff` |
| `extensions/vscode/src/diff/vertical/manager.ts:208` | `VerticalDiffManager.streamDiffLines()` — orchestrator   |
| `extensions/vscode/src/diff/vertical/handler.ts:188` | `VerticalDiffHandler.run()` — streaming loop             |
| `extensions/vscode/src/diff/vertical/handler.ts:565` | `_handleDiffLine()` — per-line editor mutations          |
| `extensions/vscode/src/diff/vertical/handler.ts:419` | `insertDeletionBuffer()` — materialises red decorations  |
| `extensions/vscode/src/diff/vertical/handler.ts:324` | `reapplyWithMyersDiff()` — post-stream correction        |
| `extensions/vscode/src/diff/vertical/handler.ts:234` | `acceptRejectBlock()` — accept/reject logic              |
