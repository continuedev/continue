# Checkpoints for agent file edits

Roadmap "Later" item, from `fork-plan.md` section 4.7, item 4. Tracked in `ROADMAP.md`.

## Problem

An Agent run can edit many files over several tool calls. If the run goes the wrong way, the user has to undo each edit by hand, or lean on git, which not every workspace uses and which cannot separate one agent turn from the user's own work. Cline offers "Restore" per message for this reason. We want the same.

## Scope

In scope:

- The four tools that change a file: `edit_existing_file`, `single_find_and_replace`, `multi_edit`, `create_new_file`.
- Snapshots kept in memory, saved with the session, and size-capped.
- A "Restore files to before this turn" action on each assistant turn, with a confirmation that lists the files that will change.
- Files the agent created (restoring deletes them) and files deleted afterwards (restoring recreates them).

Out of scope, stated in the confirm dialog too:

- **Files changed by terminal commands** (`run_terminal_command`). We cannot know ahead of time which files a command will touch, and snapshotting the whole workspace is too costly. A later change could snapshot files that git reports as modified, but the requirement here is not to rely on git.
- Edits made by MCP tools.
- Binary files, and files above the size cap.
- Redo. After a restore, the checkpoints from that turn onwards are dropped.

## Design

Everything goes through the `IDE` interface (`fileExists`, `readFile`, `writeFile`, `removeFile`, `getFileStats`), so it behaves the same in VS Code and JetBrains. No new core to webview messages are needed: edit tools already run through `callToolById` in the GUI, and sessions already persist through `history/save`.

### Data

Added to `core/index.d.ts`:

- `FileCheckpoint { uri, existed, content?, skipped? }`. `existed: false` means the agent created the file. `skipped` says why no contents were stored (`too_large`, `unreadable`, `evicted`).
- `TurnCheckpoint { turnId, createdAt, files[] }`. A turn is one user message and everything the assistant does until the next one. `turnId` is that user message's `message.id`.
- `Session.checkpoints?: TurnCheckpoint[]`, written by `HistoryManager.save` and read back by `newSession`.

### Capture

`callToolById` calls `snapshotBeforeEdit` just before running any of the four tools. It resolves the target URI the same way the tools do (`resolveCheckpointTargets`), reads it once with `snapshotFile`, and dispatches `addCheckpointSnapshot`. Only the first snapshot of a file within a turn is kept, since that is its state before the turn. A snapshot failure is logged and never blocks the tool call.

### Caps

- A file of 90,000 bytes or more is recorded as `skipped: "too_large"`. This is deliberately below the IDE's `readFile` limit: VS Code truncates at 100 KB and returns an empty string above 1 MB, so a bigger file cannot be captured faithfully and storing a truncated copy would corrupt it on restore.
- 4,000,000 stored characters per session. Past that, the oldest contents are dropped and marked `evicted`.
- A skipped or evicted file is reported as "cannot restore" and left alone. A later snapshot is never substituted for it, because that would put in a wrong state.

### Restore

For a target turn, `planRestore` takes every file touched in that turn or later and picks the earliest snapshot per file, which is the state before the target turn. `previewRestore` compares that with the current files and returns only the changes, each one `restore`, `recreate`, `delete` or `unrestorable`. The GUI shows that list in the existing `ConfirmationDialog`. On confirm, `applyRestore` writes or removes files through the IDE and collects failures instead of stopping. Afterwards `pruneCheckpointsFrom` drops the checkpoints that no longer describe the workspace.

### UI

A button in `ResponseActions` (the row under the last assistant message of a turn), shown only when that turn or a later one has a checkpoint. It is hidden while streaming, like the other actions.

## PRs

1. Checkpoints: types, `core/util/checkpoints.ts`, session persistence, snapshot in `callToolById`, restore button and dialog, tests, and this plan. One PR, because the pieces are small and only useful together.

## Tests

- `core/util/checkpoints.vitest.ts`: target resolution, snapshot (existing, missing, oversized, IDE error), first-snapshot-wins, eviction, and restore for edit, create, delete, multiple turns (including restoring twice), a turn with no edits of its own, files already matching, unrestorable files, and write failures.
- `gui/src/redux/slices/sessionSlice.checkpoints.test.ts`: reducers, load and reset on `newSession`, turn helpers.
- Not covered by automated tests: the IDE adapters themselves and the dialog rendering. See risks.

## Risks

- **Unsaved editor buffers.** VS Code's `readFile` returns the open buffer, while `writeFile` goes to disk. A restore of a file with unsaved edits may leave the buffer and disk out of step until the editor reloads. Needs manual checking in both IDEs.
- **Edits applied through the diff flow.** The snapshot is taken before the apply flow starts. If the user rejects the diff, the file is unchanged and a restore skips it as already matching.
- **User edits between turns.** A restore also reverts changes the user made to those files after the turn. The dialog says so.
- **Session file size.** Up to about 4 MB of snapshots per session is added to the session JSON. The cap bounds it, but old sessions with many edits will be larger.
- **Orphaned checkpoints.** Deleting or truncating messages leaves checkpoints whose turn is gone. They are still used when restoring an earlier turn, and are otherwise ignored.
