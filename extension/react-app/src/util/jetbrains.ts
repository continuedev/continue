import { isMetaEquivalentKeyPressed } from ".";

export const handleKeyDownJetBrains = (e, text: string, setText) => {
    const startPos = e.target.selectionStart;
    const endPos = e.target.selectionEnd;
    let newStartPos = startPos;
    let newEndPos = endPos;

    const isCmdOrCtrlPressed = isMetaEquivalentKeyPressed(e);
    const isShiftPressed = e.shiftKey;

    if (isCmdOrCtrlPressed) {
        if (e.key === 'Backspace') {
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
                const prevNewLineIndex = text.lastIndexOf('\n', startPos - 1);

                // Delete from the current position to the beginning of the line
                const newValue = text.slice(0, prevNewLineIndex + 1) + text.slice(startPos);
                setText(newValue);
                // Set the cursor to the start of the line
                e.target.selectionStart = prevNewLineIndex + 1;
                e.target.selectionEnd = prevNewLineIndex + 1;
            }
        } else if (e.key === 'ArrowLeft') {
            const prevNewLineIndex = text.lastIndexOf('\n', startPos - 1);

            newStartPos = prevNewLineIndex === -1 ? 0 : prevNewLineIndex + 1;
            newEndPos = isShiftPressed ? endPos : newStartPos;

        } else if (e.key === 'ArrowRight') {
            const nextNewLineIndex = text.indexOf('\n', startPos);
            
            newEndPos = nextNewLineIndex === -1 ? text.length : nextNewLineIndex;
            newStartPos = isShiftPressed ? newStartPos : newEndPos;
        }

        e.target.selectionStart = newStartPos;
        e.target.selectionEnd = newEndPos;
        e.preventDefault();
    }
};
