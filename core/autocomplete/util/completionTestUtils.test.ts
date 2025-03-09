import {
    processTestCase,
    type CompletionTestCase,
} from "./completionTestUtils";

describe("processTestCase utility", () => {
    it("processes simple console.log completion", () => {
        const testCase: CompletionTestCase = {
            original: "console.log(|cur||till|)",
            completion: "\"foo,\", bar",
        };

        expect(processTestCase(testCase)).toEqual({
            input: {
                lastLineOfCompletionText: "\"foo,\", bar",
                currentText: ")",
                cursorPosition: "console.log(".length,
            },
            expectedResult: {
                completionText: "\"foo,\", bar",
            },
        });
    });

    it("processes simple console.log completion with overwriting", () => {
        const testCase: CompletionTestCase = {
            original: "console.log(|cur|)|till|",
            completion: "\"foo,\", bar);",
        };

        expect(processTestCase(testCase)).toEqual({
            input: {
                lastLineOfCompletionText: "\"foo,\", bar);",
                currentText: ")",
                cursorPosition: "console.log(".length,
            },
            expectedResult: {
                completionText: "\"foo,\", bar);",
                range: {
                    start: "console.log(".length,
                    end: "console.log()".length,
                },
            },
        });
    });

    it("partially applying completion", () => {
        const testCase: CompletionTestCase = {
            original: "|cur||till|fetch(\"https://example.com\");",
            completion: "await fetch(\"https://example.com\");",
            appliedCompletion: "await ",
        };

        expect(processTestCase(testCase)).toEqual({
            input: {
                lastLineOfCompletionText: "await fetch(\"https://example.com\");",
                currentText: "fetch(\"https://example.com\");",
                cursorPosition: 0,
            },
            expectedResult: {
                completionText: "await ",
            },
        });
    });
});
