import { Editor } from "@tiptap/react";
import { KeyboardEvent } from "react";
import { isWebEnvironment } from "../../util";

const isWebEnv = isWebEnvironment();

/**
 * This handles various keypress issues when OSR is enabled
 */
export const handleJetBrainsOSRMetaKeyIssues = (
  e: KeyboardEvent,
  editor: Editor,
) => {
  const selection = window.getSelection();
  const alter = e.shiftKey ? "extend" : "move";

  const handlers: Record<string, () => void> = {
    Backspace: () => handleJetBrainsMetaBackspace(editor),
    ArrowLeft: () => selection.modify(alter, "backward", "lineboundary"),
    ArrowRight: () => selection.modify(alter, "forward", "lineboundary"),
    ArrowDown: () => selection.modify(alter, "forward", "documentboundary"),
    ArrowUp: () => {
      selection.modify(alter, "backward", "documentboundary");
    },
  };

  if (e.key in handlers) {
    e.stopPropagation();
    e.preventDefault();
    handlers[e.key]();
  }
};

/**
 * This handles reported issues with cut/copy/paste in .ipynb files in VSC
 */
export const handleVSCMetaKeyIssues = async (
  e: KeyboardEvent,
  editor: Editor,
) => {
  const text = editor.state.doc.textBetween(
    editor.state.selection.from,
    editor.state.selection.to,
  );

  const handlers: Record<string, () => Promise<void>> = {
    x: () => handleCutOperation(text, editor),
    c: () => handleCopyOperation(text),
    v: () => handlePasteOperation(editor),
  };

  if (e.key in handlers) {
    e.stopPropagation();
    e.preventDefault();
    await handlers[e.key]();
  }
};

export const handleJetBrainsMetaBackspace = (editor: Editor) => {
  const { doc } = editor.state;

  for (let i = doc.content.childCount - 1; i >= 0; i--) {
    const node = doc.content.child(i);

    if (node.type.name !== "codeBlock") {
      editor.commands.deleteNode(node.type.name);
    }
  }

  // Add an empty string so the user can keep typing
  editor.commands.createParagraphNear();
};

export const handleCutOperation = async (text: string, editor: Editor) => {
  if (isWebEnv) {
    await navigator.clipboard.writeText(text);
    editor.commands.deleteSelection();
  } else {
    document.execCommand("cut");
  }
};

export const handleCopyOperation = async (text: string) => {
  if (isWebEnv) {
    await navigator.clipboard.writeText(text);
  } else {
    document.execCommand("copy");
  }
};

export const handlePasteOperation = async (editor: Editor) => {
  if (isWebEnv) {
    const clipboardText = await navigator.clipboard.readText();
    editor.commands.insertContent(clipboardText);
  } else {
    document.execCommand("paste");
  }
};
