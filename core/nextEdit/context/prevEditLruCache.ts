import QuickLRU from "quick-lru";

export interface prevEdit {
  unidiff: string;
  fileUri: string;
  workspaceUri: string;
  timestamp: number;
}
const maxPrevEdits = 5;

export const prevEditLruCache = new QuickLRU<string, prevEdit>({
  maxSize: maxPrevEdits,
});

export const setPrevEdit = (edit: prevEdit): void => {
  const uniqueSuffix = Math.random().toString(36).substring(2, 8);
  const key = `${edit.fileUri}:${edit.timestamp}:${uniqueSuffix}`;
  prevEditLruCache.set(key, edit);
};

export const getPrevEditsDescending = (): prevEdit[] => {
  const edits: prevEdit[] = [];
  for (const [_, edit] of prevEditLruCache.entriesDescending()) {
    if (edits.length >= maxPrevEdits) {
      break;
    }
    edits.push(edit);
  }
  return edits;
};
