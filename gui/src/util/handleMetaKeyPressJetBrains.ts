import { KeyboardEvent } from "react";
import { getPlatform } from ".";

export const handleMetaKeyPressJetBrains = (
  e: KeyboardEvent,
  text: string,
  setText: (text: string) => void,
) => {
  const { selectionStart, selectionEnd } = e.target as HTMLTextAreaElement;

  if (e.key === "Backspace") {
    handleMetaBackspace(e, text, setText, selectionStart, selectionEnd);
  }

  if (getPlatform() === "mac") {
    if (e.key === "ArrowLeft") {
      handleMacArrowLeftKey(e);
    } else if (e.key === "ArrowRight") {
      handleMacArrowRightKey(e);
    }
  }
};

const handleMetaBackspace = (
  e: KeyboardEvent,
  text: string,
  setText: (text: string) => void,
  start: number,
  end: number,
) => {
  const target = e.target as HTMLTextAreaElement;
  let newStart = start;

  if (start !== end) {
    setText(text.slice(0, start) + text.slice(end));
  } else {
    newStart =
      getPlatform() === "mac"
        ? text.lastIndexOf("\n", start - 1) + 1
        : text.slice(0, start).trimEnd().lastIndexOf(" ") + 1;
    setText(text.slice(0, newStart) + text.slice(start));
  }

  target.setSelectionRange(newStart, newStart);
};

const handleMacArrowLeftKey = (e: KeyboardEvent) => {
  const target = e.target as HTMLDivElement;
  const selection = window.getSelection();

  const range = document.createRange();

  if (e.shiftKey) {
    selection.modify("extend", "backward", "character");
  } else {
    range.setStart(target.firstChild, 0);
    range.setEnd(target.firstChild, 0);

    selection.removeAllRanges();
    selection.addRange(range);
  }
};

const handleMacArrowRightKey = (e: KeyboardEvent) => {
  const selection = window.getSelection();
  const range = document.createRange();
  const target = e.target as HTMLDivElement;

  if (e.shiftKey) {
    selection.modify("extend", "forward", "character");
  } else {
    range.selectNodeContents(target);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }
};
