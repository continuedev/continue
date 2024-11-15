import { IndexingProgressUpdate } from "core";

export function getProgressPercentage(
  progress: IndexingProgressUpdate["progress"],
) {
  return Math.min(100, Math.max(0, progress * 100));
}

export const STATUS_TO_TEXT: Record<IndexingProgressUpdate["status"], string> =
  {
    done: "Indexing complete",
    loading: "Initializing",
    indexing: "Indexing in-progress",
    paused: "Indexing paused",
    failed: "Indexing failed",
    disabled: "Indexing disabled",
  };
