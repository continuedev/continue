import { QuickPickItem, window, ExtensionContext } from "vscode";

const HISTORY_KEY = "quickEditHistory";
const MAX_HISTORY_LENGTH = 50;

export function appendToHistory(
  prompt: string,
  { globalState }: ExtensionContext,
) {
  let history: string[] = globalState.get(HISTORY_KEY, []);

  // Remove duplicate if exists
  if (history[history.length - 1] === prompt) {
    history = history.slice(0, -1);
  }

  // Add new item
  history.push(prompt);

  // Truncate if over max size
  if (history.length > MAX_HISTORY_LENGTH) {
    history = history.slice(-MAX_HISTORY_LENGTH);
  }

  globalState.update(HISTORY_KEY, history);
}

export async function getHistoryQuickPickVal({
  globalState,
}: ExtensionContext): Promise<string | undefined> {
  const historyItems: QuickPickItem[] = globalState
    .get(HISTORY_KEY, [])
    .map((item) => ({ label: item }))
    .reverse();

  const selectedItem = await window.showQuickPick(historyItems, {
    title: "History",
    placeHolder: "Select a previous prompt",
  });

  return selectedItem?.label;
}
