import { DiffLine } from "..";

export function isNextEditTest(): boolean {
  const enabled = process.env.NEXT_EDIT_TEST_ENABLED;

  if (enabled === "false") {
    return false;
  }

  if (enabled === "true") {
    return true;
  }

  return false;
}

export function isWhitespaceOnlyDeletion(diffLines: DiffLine[]): boolean {
  return diffLines.every(
    (diff) =>
      diff.type === "old" &&
      (diff.line.trim() === "" || /^\s+$/.test(diff.line)),
  );
}
