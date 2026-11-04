import type { FileCheckpoint, IDE, TurnCheckpoint } from "..";
import { BuiltInToolNames } from "../tools/builtIn";
import {
  inferResolvedUriFromRelativePath,
  resolveRelativePathInDir,
} from "./ideUtils";

/*
  Checkpoints for agent file edits.

  Before an agent edit tool runs we snapshot the prior contents of the file it
  is about to change. Snapshots are grouped by "turn" (one user message and
  everything the assistant does in reply) and persisted with the session.
  "Restore to here" rewinds every file touched from that turn onwards to the
  state it had before that turn started.

  Everything goes through the IDE interface (readFile / writeFile /
  removeFile), so it works in VS Code and JetBrains and needs no version control.

  Out of scope: files changed by terminal commands (run_terminal_command) are
  not tracked, because we cannot know in advance which files a command touches.
*/

/** Tools whose calls can change a file and so get a snapshot first. */
export const CHECKPOINT_TOOL_NAMES: string[] = [
  BuiltInToolNames.EditExistingFile,
  BuiltInToolNames.SingleFindAndReplace,
  BuiltInToolNames.MultiEdit,
  BuiltInToolNames.CreateNewFile,
];

/**
 * Largest file we snapshot. IDE readFile implementations truncate at about
 * 100,000 bytes (VS Code returns the first 100 KB, or "" above 1 MB), so a
 * larger file cannot be captured faithfully and is skipped instead of stored
 * truncated, which would corrupt it on restore.
 */
export const MAX_CHECKPOINT_FILE_BYTES = 90_000;

/** Cap on stored characters across a whole session; oldest contents go first. */
export const MAX_CHECKPOINT_SESSION_CHARS = 4_000_000;

/** Work out which file(s) a tool call is about to change. Never throws. */
export async function resolveCheckpointTargets(
  toolName: string,
  args: any,
  ide: IDE,
): Promise<string[]> {
  try {
    if (!CHECKPOINT_TOOL_NAMES.includes(toolName)) {
      return [];
    }
    let filepath = args?.filepath;
    if (typeof filepath !== "string" || !filepath) {
      return [];
    }
    if (toolName === BuiltInToolNames.CreateNewFile) {
      return [await inferResolvedUriFromRelativePath(filepath, ide)];
    }
    // Mirrors how the edit tools resolve their target
    if (filepath.startsWith("./")) {
      filepath = filepath.slice(2);
    }
    const resolved = await resolveRelativePathInDir(filepath, ide);
    if (resolved) {
      return [resolved];
    }
    for (const uri of await ide.getOpenFiles()) {
      if (uri.endsWith(filepath)) {
        return [uri];
      }
    }
  } catch (e) {
    console.warn("Failed to resolve checkpoint target", e);
  }
  return [];
}

/** Capture the current state of one file. Never throws. */
export async function snapshotFile(
  ide: IDE,
  uri: string,
): Promise<FileCheckpoint> {
  try {
    if (!(await ide.fileExists(uri))) {
      return { uri, existed: false };
    }
    let size: number | undefined;
    try {
      size = (await ide.getFileStats([uri]))?.[uri]?.size;
    } catch {
      // fall through to the length check below
    }
    if (size !== undefined && size >= MAX_CHECKPOINT_FILE_BYTES) {
      return { uri, existed: true, skipped: "too_large" };
    }
    const content = await ide.readFile(uri);
    if (content.length >= MAX_CHECKPOINT_FILE_BYTES) {
      return { uri, existed: true, skipped: "too_large" };
    }
    return { uri, existed: true, content };
  } catch {
    return { uri, existed: true, skipped: "unreadable" };
  }
}

function storedChars(checkpoints: TurnCheckpoint[]): number {
  let total = 0;
  for (const turn of checkpoints) {
    for (const file of turn.files) {
      total += file.content?.length ?? 0;
    }
  }
  return total;
}

/**
 * Record a snapshot for a turn. Only the first snapshot of a file within a
 * turn is kept, since that is the state before the turn. Returns a new array.
 */
export function addFileSnapshot(
  checkpoints: TurnCheckpoint[],
  turnId: string,
  file: FileCheckpoint,
  now: number = Date.now(),
  maxChars: number = MAX_CHECKPOINT_SESSION_CHARS,
): TurnCheckpoint[] {
  const existing = checkpoints.find((c) => c.turnId === turnId);
  if (existing?.files.some((f) => f.uri === file.uri)) {
    return checkpoints;
  }
  let next: TurnCheckpoint[] = existing
    ? checkpoints.map((c) =>
        c === existing ? { ...c, files: [...c.files, file] } : c,
      )
    : [...checkpoints, { turnId, createdAt: now, files: [file] }];

  // Evict the oldest stored contents once over the cap. The evicted file is
  // marked, so a restore reports it instead of silently using a later snapshot.
  let total = storedChars(next);
  if (total > maxChars) {
    next = next.map((c) => ({ ...c, files: [...c.files] }));
    outer: for (const turn of next) {
      for (let i = 0; i < turn.files.length; i++) {
        const f = turn.files[i];
        if (f.content === undefined || f === file) {
          continue;
        }
        total -= f.content.length;
        turn.files[i] = { uri: f.uri, existed: f.existed, skipped: "evicted" };
        if (total <= maxChars) {
          break outer;
        }
      }
    }
  }
  return next;
}

/** Index of the first checkpoint belonging to the target turn or a later one. */
function firstAffectedIndex(
  checkpoints: TurnCheckpoint[],
  turnOrder: string[],
  targetTurnId: string,
): number {
  const targetIdx = turnOrder.indexOf(targetTurnId);
  if (targetIdx === -1) {
    return -1;
  }
  const affected = new Set(turnOrder.slice(targetIdx));
  return checkpoints.findIndex((c) => affected.has(c.turnId));
}

/** Whether restoring to this turn would have anything to undo. */
export function hasCheckpointsFrom(
  checkpoints: TurnCheckpoint[],
  turnOrder: string[],
  targetTurnId: string,
): boolean {
  return firstAffectedIndex(checkpoints, turnOrder, targetTurnId) !== -1;
}

/**
 * For each file touched in the target turn or later, the snapshot taken
 * before its first change in that range, i.e. its state before the target turn.
 * `turnOrder` is the user message ids in conversation order.
 */
export function planRestore(
  checkpoints: TurnCheckpoint[],
  turnOrder: string[],
  targetTurnId: string,
): FileCheckpoint[] {
  const start = firstAffectedIndex(checkpoints, turnOrder, targetTurnId);
  if (start === -1) {
    return [];
  }
  const earliest = new Map<string, FileCheckpoint>();
  for (const turn of checkpoints.slice(start)) {
    for (const file of turn.files) {
      if (!earliest.has(file.uri)) {
        earliest.set(file.uri, file);
      }
    }
  }
  return [...earliest.values()];
}

/** Checkpoints that remain valid after restoring to the target turn. */
export function pruneCheckpointsFrom(
  checkpoints: TurnCheckpoint[],
  turnOrder: string[],
  targetTurnId: string,
): TurnCheckpoint[] {
  const start = firstAffectedIndex(checkpoints, turnOrder, targetTurnId);
  return start === -1 ? checkpoints : checkpoints.slice(0, start);
}

export type RestoreAction =
  /** The file exists but differs; overwrite with the snapshot */
  | "restore"
  /** The agent (or the user) deleted the file; write it back */
  | "recreate"
  /** The agent created the file; remove it */
  | "delete"
  /** No stored contents; the file is left alone */
  | "unrestorable";

export interface RestoreItem {
  uri: string;
  action: RestoreAction;
  snapshot: FileCheckpoint;
}

/** Compare the plan with the files as they are now; only changes are returned. */
export async function previewRestore(
  ide: IDE,
  plan: FileCheckpoint[],
): Promise<RestoreItem[]> {
  const items: RestoreItem[] = [];
  for (const snapshot of plan) {
    const { uri } = snapshot;
    if (snapshot.existed && snapshot.content === undefined) {
      items.push({ uri, action: "unrestorable", snapshot });
      continue;
    }
    const existsNow = await ide.fileExists(uri);
    if (!snapshot.existed) {
      if (existsNow) {
        items.push({ uri, action: "delete", snapshot });
      }
    } else if (!existsNow) {
      items.push({ uri, action: "recreate", snapshot });
    } else if ((await ide.readFile(uri)) !== snapshot.content) {
      items.push({ uri, action: "restore", snapshot });
    }
  }
  return items;
}

export interface RestoreResult {
  restored: string[];
  deleted: string[];
  failed: { uri: string; error: string }[];
}

export async function applyRestore(
  ide: IDE,
  items: RestoreItem[],
): Promise<RestoreResult> {
  const result: RestoreResult = { restored: [], deleted: [], failed: [] };
  for (const { uri, action, snapshot } of items) {
    try {
      if (action === "delete") {
        await ide.removeFile(uri);
        result.deleted.push(uri);
      } else if (action === "restore" || action === "recreate") {
        await ide.writeFile(uri, snapshot.content ?? "");
        result.restored.push(uri);
      }
    } catch (e) {
      result.failed.push({
        uri,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return result;
}
