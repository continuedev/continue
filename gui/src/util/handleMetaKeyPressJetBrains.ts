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

  if (getPlatform() === "mac" && ["ArrowLeft", "ArrowRight"].includes(e.key)) {
    handleMacArrowKeys(e, text, selectionStart, selectionEnd);
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

// const handleMacArrowKeys = (
//   e: KeyboardEvent,
//   text: string,
//   start: number,
//   end: number,
// ) => {
//   debugger;
//   const target = e.target as HTMLDivElement;
//   const selection = window.getSelection();
//   const range = document.createRange();

//   let newStart = start,
//     newEnd = end;

//   if (e.key === "ArrowLeft") {
//     newStart = text.lastIndexOf("\n", start - 1) + 1;
//     newEnd = e.shiftKey ? end : newStart;
//   } else if (e.key === "ArrowRight") {
//     const nextNewline = text.indexOf("\n", end);
//     newEnd = nextNewline === -1 ? text.length : nextNewline;
//     newStart = e.shiftKey ? start : newEnd;
//   }

//   range.setStart(target.firstChild!, newStart);
//   range.setEnd(target.firstChild!, newEnd);

//   selection?.removeAllRanges();
//   selection?.addRange(range);
// };

const handleMacArrowKeys = (
  e: KeyboardEvent,
  text: string,
  start: number,
  end: number,
) => {
  const target = e.target as HTMLDivElement;
  const paragraph = target.firstChild as HTMLParagraphElement;
  const selection = window.getSelection();
  const range = document.createRange();

  if (!selection) return;

  let newPosition: number;

  if (e.key === "ArrowLeft") {
    newPosition = 0; // Beginning of the paragraph
  } else if (e.key === "ArrowRight") {
    newPosition = paragraph.textContent?.length - 1 || 0; // End of the paragraph

    const range = document.createRange(); //Create a range (a range is a like the selection but invisible)
    range.selectNodeContents(target); //Select the entire contents of the element with the range
    range.collapse(false); //collapse the range to the end point. false means collapse to end rather than the start
    selection.removeAllRanges(); //remove any selections already made
    selection.addRange(range); //make the range you have just created the visible selection
    return;
  } else {
    return;
  }

  if (e.shiftKey) {
    // If Shift key is pressed, extend the selection
    if (selection.anchorNode === paragraph) {
      range.setStart(paragraph, selection.anchorOffset);
    } else {
      range.setStart(paragraph, 0);
    }
    range.setEnd(paragraph, newPosition);
  } else {
    // If Shift key is not pressed, just move the cursor
    range.setStart(paragraph, newPosition);
    range.collapse(true);
  }

  // Apply the new selection
  selection.removeAllRanges();
  selection.addRange(range);
};
