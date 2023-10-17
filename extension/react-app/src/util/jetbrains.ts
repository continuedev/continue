import { isMetaEquivalentKeyPressed } from ".";

export const handleKeyDownJetBrainsMac = (e, text: string, setText) => {
  const isCmdOrCtrlPressed = isMetaEquivalentKeyPressed(e);

  if (isCmdOrCtrlPressed && e.key === "Backspace") {
    e.preventDefault();

    const startPos = e.target.selectionStart;
    const endPos = e.target.selectionEnd;

    if (startPos !== endPos) {
      // If some text is selected, just delete that text
      const newValue = text.slice(0, startPos) + text.slice(endPos);
      setText(newValue);
      // Set the cursor to where the selection started
      e.target.selectionStart = startPos;
      e.target.selectionEnd = startPos;
    } else {
      // Find the start of the current line
      const prevNewLineIndex = text.lastIndexOf("\n", startPos - 1);

      // Delete from the current position to the beginning of the line
      const newValue =
        text.slice(0, prevNewLineIndex + 1) + text.slice(startPos);
      setText(newValue);
      // Set the cursor to the start of the line
      e.target.selectionStart = prevNewLineIndex + 1;
      e.target.selectionEnd = prevNewLineIndex + 1;
    }
  }
};

export const handleKeyDownJetBrains = (e, text: string, setText) => {
  const startPos = e.target.selectionStart;
  const endPos = e.target.selectionEnd;

  const isCtrlPressed = isMetaEquivalentKeyPressed(e);

  if (isCtrlPressed && e.key === "Backspace") {
    e.preventDefault();

    if (startPos !== endPos) {
      // If some text is selected, just delete that text
      const newValue = text.slice(0, startPos) + text.slice(endPos);
      setText(newValue);

      // Set the cursor to where the selection started
      e.target.selectionStart = startPos;
      e.target.selectionEnd = startPos;
    } else {
      // Find the start of the current word
      const prevSpaceIndex = text.slice(0, startPos).trimEnd().lastIndexOf(" ");

      // Delete from the current position to the beginning of the word
      const newValue = text.slice(0, prevSpaceIndex + 1) + text.slice(startPos);
      setText(newValue);

      // Set the cursor to the start of the word
      console.log(prevSpaceIndex);
      setTimeout(() => {
        // The browser likes to set the cursor to the end bc setText is delayed, so we wait, imperceptibly
        e.target.selectionStart = prevSpaceIndex + 1;
        e.target.selectionEnd = prevSpaceIndex + 1;
      }, 10);
    }
  }
};
