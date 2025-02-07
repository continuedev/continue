export interface CompletionTestCase {
    original: string;    // Text with |cur| and |till| markers
    completion: string;  // Text to insert/overwrite
    appliedCompletion?: string | null;
    cursorMarker?: string;
    tillMarker?: string;
}

export interface ProcessedTestCase {
    input: {
        lastLineOfCompletionText: string;
        currentText: string;
        cursorPosition: number;
    };
    expectedResult: {
        completionText: string;
        range?: {
            start: number;
            end: number;
        };
    };
}

export function processTestCase({
    original,
    completion,
    appliedCompletion = null,
    cursorMarker = "|cur|",
    tillMarker = "|till|",
}: CompletionTestCase): ProcessedTestCase {
    // Validate cursor marker
    if (!original.includes(cursorMarker)) {
        throw new Error("Cursor marker not found in original text");
    }

    const cursorPos = original.indexOf(cursorMarker);
    original = original.replace(cursorMarker, "");

    let tillPos = original.indexOf(tillMarker);
    if (tillPos < 0) {
        tillPos = cursorPos;
    } else {
        original = original.replace(tillMarker, "")
    }

    // Calculate currentText based on what's between cursor and till marker
    const currentText = original.substring(cursorPos);

    return {
        input: {
            lastLineOfCompletionText: completion,
            currentText,
            cursorPosition: cursorPos,
        },
        expectedResult: {
            completionText: appliedCompletion || completion,
            range: cursorPos === tillPos ? undefined : {
                start: cursorPos,
                end: tillPos,
            },
        },
    };
}