import { afterEach, beforeEach, expect, test, vi } from "vitest";

import type * as vscode from "vscode";

const mocks = vi.hoisted(() => ({
  openTextDocument: vi.fn<(uri: vscode.Uri) => Promise<vscode.TextDocument>>(),
  showTextDocument:
    vi.fn<
      (
        document: vscode.TextDocument,
        options?: vscode.TextDocumentShowOptions,
      ) => Promise<vscode.TextEditor>
    >(),
  tabGroups: {
    all: [] as {
      viewColumn: vscode.ViewColumn;
      tabs: { input: { uri: vscode.Uri } }[];
    }[],
  },
}));

vi.mock("vscode", () => ({
  workspace: { openTextDocument: mocks.openTextDocument },
  window: {
    showTextDocument: mocks.showTextDocument,
    tabGroups: mocks.tabGroups,
  },
}));

const uri = {
  scheme: "file",
  host: "",
  path: "/test/config.yaml",
  toString: () => "file:///test/config.yaml",
} as unknown as vscode.Uri;
const document = { uri } as vscode.TextDocument;
const revealRange = vi.fn();
const editor = { document, revealRange } as unknown as vscode.TextEditor;

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  mocks.openTextDocument.mockReset().mockResolvedValue(document);
  mocks.showTextDocument.mockReset().mockResolvedValue(editor);
  mocks.tabGroups.all = [];
  revealRange.mockReset();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

test("openEditorAndRevealRange opens the requested document and reveals its range", async () => {
  const { openEditorAndRevealRange } = await import("./vscode");
  const range = {
    start: { line: 1, character: 0 },
    end: { line: 2, character: 0 },
  } as vscode.Range;

  await expect(openEditorAndRevealRange(uri, range, 1, false)).resolves.toBe(
    editor,
  );
  expect(mocks.openTextDocument).toHaveBeenCalledWith(uri);
  expect(mocks.showTextDocument).toHaveBeenCalledWith(document, {
    viewColumn: 1,
    preview: false,
  });
  expect(revealRange).toHaveBeenCalledWith(range);
});

test("openEditorAndRevealRange preserves an existing editor's view column", async () => {
  const { openEditorAndRevealRange } = await import("./vscode");
  mocks.tabGroups.all = [{ viewColumn: 2, tabs: [{ input: { uri } }] }];

  await openEditorAndRevealRange(uri, undefined, 1);

  expect(mocks.showTextDocument).toHaveBeenCalledWith(document, {
    viewColumn: 2,
    preview: undefined,
  });
});

test("openEditorAndRevealRange rejects when the document cannot be opened", async () => {
  const { openEditorAndRevealRange } = await import("./vscode");
  const error = new Error("Config file is unavailable");
  mocks.openTextDocument.mockRejectedValueOnce(error);

  await expect(openEditorAndRevealRange(uri)).rejects.toBe(error);
  expect(mocks.showTextDocument).not.toHaveBeenCalled();
  await expect(openEditorAndRevealRange(uri)).resolves.toBe(editor);
});

test("openEditorAndRevealRange rejects a failed display and allows the next open", async () => {
  const { openEditorAndRevealRange } = await import("./vscode");
  const error = new Error("Editor is unavailable");
  mocks.showTextDocument.mockRejectedValueOnce(error);

  await expect(openEditorAndRevealRange(uri)).rejects.toBe(error);
  await expect(openEditorAndRevealRange(uri)).resolves.toBe(editor);
  expect(mocks.showTextDocument).toHaveBeenCalledTimes(2);
});

test("openEditorAndRevealRange releases the opening flag when revealing a range throws", async () => {
  const { openEditorAndRevealRange } = await import("./vscode");
  const error = new Error("Unable to reveal range");
  revealRange.mockImplementationOnce(() => {
    throw error;
  });

  await expect(openEditorAndRevealRange(uri, {} as vscode.Range)).rejects.toBe(
    error,
  );
  await expect(openEditorAndRevealRange(uri)).resolves.toBe(editor);
});

test("openEditorAndRevealRange serializes concurrent displays without leaving timers", async () => {
  const { openEditorAndRevealRange } = await import("./vscode");
  let release!: (editor: vscode.TextEditor) => void;
  mocks.showTextDocument.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );

  const first = openEditorAndRevealRange(uri);
  await vi.advanceTimersByTimeAsync(0);
  const second = openEditorAndRevealRange(uri);
  const third = openEditorAndRevealRange(uri);
  await vi.advanceTimersByTimeAsync(0);
  expect(mocks.showTextDocument).toHaveBeenCalledTimes(1);

  release(editor);
  await expect(first).resolves.toBe(editor);
  await vi.runAllTimersAsync();
  await expect(Promise.all([second, third])).resolves.toEqual([editor, editor]);
  expect(mocks.showTextDocument).toHaveBeenCalledTimes(3);
  expect(vi.getTimerCount()).toBe(0);
});

test("openEditorAndRevealRange resumes a waiting open after the active display fails", async () => {
  const { openEditorAndRevealRange } = await import("./vscode");
  let reject!: (error: Error) => void;
  mocks.showTextDocument.mockImplementationOnce(
    () =>
      new Promise((_, rejectPromise) => {
        reject = rejectPromise;
      }),
  );
  const error = new Error("Editor display failed");
  const first = openEditorAndRevealRange(uri);
  const rejection = expect(first).rejects.toBe(error);
  await vi.advanceTimersByTimeAsync(0);
  const second = openEditorAndRevealRange(uri);
  await vi.advanceTimersByTimeAsync(0);
  expect(mocks.showTextDocument).toHaveBeenCalledTimes(1);

  reject(error);
  await rejection;
  await vi.runAllTimersAsync();
  await expect(second).resolves.toBe(editor);
  expect(mocks.showTextDocument).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});
