/**
 * Helper for breakTextIntoRows: Handle a word that contains newline characters
 */
const handleWordWithNewlines = (
  word: string,
  currentRow: string,
  availableWidth: number,
  rows: string[],
): string => {
  const parts = word.split("\n");
  let updatedCurrentRow = currentRow;

  // Add first part to current row if there's space
  if (parts[0]) {
    const testRow =
      updatedCurrentRow + (updatedCurrentRow ? " " : "") + parts[0];
    if (testRow.length <= availableWidth) {
      updatedCurrentRow = testRow;
    } else {
      // Current word doesn't fit, start new row
      if (updatedCurrentRow) {
        rows.push(updatedCurrentRow);
      }
      updatedCurrentRow = parts[0];
    }
  }

  // Handle newline breaks
  if (updatedCurrentRow || parts[0] === "") {
    rows.push(updatedCurrentRow);
  }

  // Process remaining parts after newlines
  for (let j = 1; j < parts.length - 1; j++) {
    rows.push(parts[j]);
  }

  // Set current row to last part
  return parts[parts.length - 1] || "";
};

/**
 * Helper for breakTextIntoRows: Handle a regular word without newlines
 */
const handleRegularWord = (
  word: string,
  currentRow: string,
  availableWidth: number,
  rows: string[],
): string => {
  const testRow = currentRow + (currentRow ? " " : "") + word;

  if (testRow.length <= availableWidth) {
    // Word fits in current row
    return testRow;
  }

  // Word doesn't fit, start new row
  if (currentRow) {
    rows.push(currentRow);
  }

  // Check if single word is longer than available width
  if (word.length > availableWidth) {
    // Split long word by characters as fallback
    let remainingWord = word;
    while (remainingWord.length > availableWidth) {
      rows.push(remainingWord.substring(0, availableWidth));
      remainingWord = remainingWord.substring(availableWidth);
    }
    return remainingWord;
  }

  return word;
};

/**
 * Break text into chunks that fit within available width
 * Respects word boundaries to avoid splitting words across rows
 */
export const breakTextIntoRows = (text: string, width: number): string[] => {
  const rows: string[] = [];
  let currentRow = "";
  const availableWidth = width - 6;

  const words = text.split(" ");

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    if (word.includes("\n")) {
      currentRow = handleWordWithNewlines(
        word,
        currentRow,
        availableWidth,
        rows,
      );
    } else {
      currentRow = handleRegularWord(word, currentRow, availableWidth, rows);
    }
  }

  // Add the final row if it has content
  if (currentRow.length > 0 || rows.length === 0) {
    rows.push(currentRow);
  }

  return rows;
};
