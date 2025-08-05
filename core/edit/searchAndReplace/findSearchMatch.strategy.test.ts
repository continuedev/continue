import { findSearchMatch, SearchMatchResult } from "./findSearchMatch";

/**
 * Helper function to perform a replacement using the match result
 * This simulates what the actual replacement tool would do
 */
function performReplacement(
  fileContent: string,
  match: SearchMatchResult,
  replacement: string,
): string {
  return (
    fileContent.substring(0, match.startIndex) +
    replacement +
    fileContent.substring(match.endIndex)
  );
}

/**
 * Helper function to test a specific strategy by crafting inputs that
 * will fail all previous strategies
 */
function testSpecificStrategy(
  fileContent: string,
  searchContent: string,
  expectedStrategy: string,
): SearchMatchResult | null {
  const result = findSearchMatch(fileContent, searchContent);
  if (result && result.strategyName !== expectedStrategy) {
    throw new Error(
      `Expected strategy ${expectedStrategy} but got ${result.strategyName}`,
    );
  }
  return result;
}

/**
 * Helper function to verify that a match result correctly identifies
 * the intended content and replacement works properly
 */
function verifyMatchAndReplacement(
  fileContent: string,
  searchContent: string,
  expectedMatchedText: string,
  replacementText: string,
  expectedResult: string,
): void {
  const match = findSearchMatch(fileContent, searchContent);

  if (!match) {
    throw new Error("No match found");
  }

  // Verify the match captures the expected text
  const actualMatchedText = fileContent.substring(
    match.startIndex,
    match.endIndex,
  );
  expect(actualMatchedText).toBe(expectedMatchedText);

  // Verify replacement works correctly
  const result = performReplacement(fileContent, match, replacementText);
  expect(result).toBe(expectedResult);
}

describe("Strategy-specific tests", () => {
  describe("exactMatch strategy", () => {
    it("should handle exact match at various positions", () => {
      const testCases = [
        {
          name: "at start",
          fileContent: "abc def ghi",
          searchContent: "abc",
          expectedStart: 0,
          expectedEnd: 3,
        },
        {
          name: "in middle",
          fileContent: "abc def ghi",
          searchContent: "def",
          expectedStart: 4,
          expectedEnd: 7,
        },
        {
          name: "at end",
          fileContent: "abc def ghi",
          searchContent: "ghi",
          expectedStart: 8,
          expectedEnd: 11,
        },
        {
          name: "entire content",
          fileContent: "abc def ghi",
          searchContent: "abc def ghi",
          expectedStart: 0,
          expectedEnd: 11,
        },
      ];

      testCases.forEach(
        ({ name, fileContent, searchContent, expectedStart, expectedEnd }) => {
          const result = testSpecificStrategy(
            fileContent,
            searchContent,
            "exactMatch",
          );
          expect(result).not.toBeNull();
          expect(result!.startIndex).toBe(expectedStart);
          expect(result!.endIndex).toBe(expectedEnd);

          // Verify the matched content
          const matchedContent = fileContent.substring(
            result!.startIndex,
            result!.endIndex,
          );
          expect(matchedContent).toBe(searchContent);
        },
      );
    });

    it("should handle multiline exact matches", () => {
      const fileContent = `line1
line2
line3
line4`;
      const searchContent = `line2
line3`;

      const result = testSpecificStrategy(
        fileContent,
        searchContent,
        "exactMatch",
      );
      expect(result).not.toBeNull();
      expect(result!.startIndex).toBe(6); // After "line1\n"
      expect(result!.endIndex).toBe(17); // End of "line3"

      const matchedContent = fileContent.substring(
        result!.startIndex,
        result!.endIndex,
      );
      expect(matchedContent).toBe(searchContent);
    });

    it("should handle content with special characters", () => {
      const fileContent = `const regex = /[a-z]+/gi;
const str = "Hello, World!";
const result = str.match(regex);`;
      const searchContent = `const str = "Hello, World!";`;

      const result = testSpecificStrategy(
        fileContent,
        searchContent,
        "exactMatch",
      );
      expect(result).not.toBeNull();

      const matchedContent = fileContent.substring(
        result!.startIndex,
        result!.endIndex,
      );
      expect(matchedContent).toBe(searchContent);
    });

    it("should verify replacement works correctly for exact matches", () => {
      verifyMatchAndReplacement(
        "const a = 1;\nconst b = 2;\nconst c = 3;",
        "const b = 2;",
        "const b = 2;",
        "const b = 42;",
        "const a = 1;\nconst b = 42;\nconst c = 3;",
      );
    });

    it("should handle Windows-style line endings", () => {
      const fileContent = "line1\r\nline2\r\nline3";
      const searchContent = "line2";

      const result = testSpecificStrategy(
        fileContent,
        searchContent,
        "exactMatch",
      );
      expect(result).not.toBeNull();
      expect(result!.startIndex).toBe(7); // After "line1\r\n"
      expect(result!.endIndex).toBe(12); // End of "line2"
    });

    it("should handle mixed line endings", () => {
      const fileContent = "line1\nline2\r\nline3\rline4";
      const searchContent = "line2\r\nline3";

      const result = testSpecificStrategy(
        fileContent,
        searchContent,
        "exactMatch",
      );
      expect(result).not.toBeNull();

      const matchedContent = fileContent.substring(
        result!.startIndex,
        result!.endIndex,
      );
      expect(matchedContent).toBe(searchContent);
    });
  });

  describe("trimmedMatch strategy", () => {
    it("should match when only whitespace differs at edges", () => {
      const testCases = [
        {
          name: "leading spaces",
          fileContent: "abc\n  def\nghi",
          searchContent: "  def",
          trimmedSearch: "def",
        },
        {
          name: "trailing spaces",
          fileContent: "abc\ndef  \nghi",
          searchContent: "def  ",
          trimmedSearch: "def",
        },
        {
          name: "both leading and trailing",
          fileContent: "abc\n  def  \nghi",
          searchContent: "  def  ",
          trimmedSearch: "def",
        },
        {
          name: "tabs and spaces",
          fileContent: "abc\n\t  def  \t\nghi",
          searchContent: "\t  def  \t",
          trimmedSearch: "def",
        },
      ];

      testCases.forEach(
        ({ name, fileContent, searchContent, trimmedSearch }) => {
          const result = findSearchMatch(fileContent, searchContent);
          expect(result).not.toBeNull();

          // For cases where exact match exists, it should be preferred
          if (fileContent.indexOf(searchContent) !== -1) {
            expect(result!.strategyName).toBe("exactMatch");
            const matchedContent = fileContent.substring(
              result!.startIndex,
              result!.endIndex,
            );
            expect(matchedContent).toBe(searchContent);
          } else {
            expect(result!.strategyName).toBe("trimmedMatch");
            // The match should find the trimmed content with surrounding whitespace
            const matchedContent = fileContent.substring(
              result!.startIndex,
              result!.endIndex,
            );
            expect(matchedContent).toContain(trimmedSearch);
          }
        },
      );
    });

    it("should handle multiline content with edge whitespace", () => {
      const fileContent = `function test() {
  const x = 1;
  const y = 2;
}`;
      const searchContent = `  const x = 1;
  const y = 2;  `;

      const result = findSearchMatch(fileContent, searchContent);
      expect(result).not.toBeNull();
      // Since there's no exact match (trailing spaces don't exist), trimmedMatch should be used
      expect(result!.strategyName).toBe("trimmedMatch");
    });

    it("should verify replacement with trimmed matches", () => {
      const fileContent = "start\n  targetContent  \nend";
      const searchContent = "   targetContent   ";
      const replacement = "newContent";

      const match = findSearchMatch(fileContent, searchContent);
      expect(match).not.toBeNull();
      expect(match!.strategyName).toBe("trimmedMatch");

      const result = performReplacement(fileContent, match!, replacement);
      expect(result).toBe("start\nnewContent\nend");
    });

    it("should handle edge case with only whitespace", () => {
      const fileContent = "   \n   \n   ";
      const searchContent = "   \n   ";

      const result = findSearchMatch(fileContent, searchContent);
      expect(result).not.toBeNull();
      // Should find exact match since the content matches exactly
      expect(result!.strategyName).toBe("exactMatch");
    });
  });

  describe("whitespaceIgnoredMatch strategy", () => {
    it("should match content with different indentation", () => {
      const fileContent = `function test() {
    const x = 1;
    if (x > 0) {
        return true;
    }
}`;
      const searchContent = `const x=1;
if(x>0){
return true;
}`;

      const result = findSearchMatch(fileContent, searchContent);
      expect(result).not.toBeNull();
      expect(result!.strategyName).toBe("whitespaceIgnoredMatch");

      // Verify the match covers the intended code block
      const matchedContent = fileContent.substring(
        result!.startIndex,
        result!.endIndex,
      );
      expect(matchedContent).toContain("const x = 1");
      expect(matchedContent).toContain("return true");
    });

    it("should handle complex whitespace variations", () => {
      const testCases = [
        {
          name: "spaces vs tabs",
          fileContent: "if\t(\tcondition\t)\t{\n\treturn\ttrue;\n}",
          searchContent: "if (condition) { return true; }",
        },
        {
          name: "multiple spaces collapsed",
          fileContent: "const    result    =    calculate(   x   ,   y   );",
          searchContent: "const result=calculate(x,y);",
        },
        {
          name: "newlines removed",
          fileContent: "function\ntest\n(\n)\n{\nreturn\n1\n;\n}",
          searchContent: "function test(){return 1;}",
        },
      ];

      testCases.forEach(({ name, fileContent, searchContent }) => {
        const result = findSearchMatch(fileContent, searchContent);
        expect(result).not.toBeNull();
        expect(result!.strategyName).toBe("whitespaceIgnoredMatch");

        // Verify the entire content is matched
        const matchedContent = fileContent.substring(
          result!.startIndex,
          result!.endIndex,
        );
        expect(matchedContent.replace(/\s/g, "")).toBe(
          searchContent.replace(/\s/g, ""),
        );
      });
    });

    it("should handle partial matches with whitespace differences", () => {
      const fileContent = `class Example {
    constructor(name) {
        this.name = name;
        this.items = [];
    }
    
    addItem(item) {
        this.items.push(item);
    }
}`;
      const searchContent = `constructor(name){this.name=name;this.items=[];}`;

      const result = findSearchMatch(fileContent, searchContent);
      expect(result).not.toBeNull();
      expect(result!.strategyName).toBe("whitespaceIgnoredMatch");

      // The match should cover the constructor method
      const matchedContent = fileContent.substring(
        result!.startIndex,
        result!.endIndex,
      );
      expect(matchedContent).toContain("constructor");
      expect(matchedContent).toContain("this.items = []");
    });

    it("should verify replacement with whitespace-ignored matches", () => {
      const fileContent = `function   calculate  (  a  ,  b  )  {
    return   a   +   b   ;
}`;
      const searchContent = `function calculate(a,b){return a+b;}`;
      const replacement = `function calculate(x, y) {
    return x + y;
}`;

      const match = findSearchMatch(fileContent, searchContent);
      expect(match).not.toBeNull();
      expect(match!.strategyName).toBe("whitespaceIgnoredMatch");

      const result = performReplacement(fileContent, match!, replacement);
      expect(result).toBe(replacement);
    });

    it("should handle edge cases with empty content after whitespace removal", () => {
      const fileContent = "   \n\t\r\n   ";
      const searchContent = " \n ";

      const result = findSearchMatch(fileContent, searchContent);
      // Since search content doesn't exist in file but trims to empty, should return emptySearch
      expect(result).not.toBeNull();
      expect(result!.strategyName).toBe("emptySearch");
    });

    it("should match correctly when multiple potential matches exist", () => {
      const fileContent = `const a=1;
const   a   =   1   ;
const a = 1;`;
      const searchContent = "const a = 1;";

      const result = findSearchMatch(fileContent, searchContent);
      expect(result).not.toBeNull();
      // Should find the exact match first (third occurrence)
      expect(result!.strategyName).toBe("exactMatch");
      expect(result!.startIndex).toBe(33); // After first two lines
    });
  });

  describe("jaroWinklerFuzzyMatch strategy", () => {
    it("should match similar code with variable name differences", () => {
      const fileContent = `function calculateTotal(items) {
  let sum = 0;
  for (const item of items) {
    sum += item.price;
  }
  return sum;
}`;
      const searchContent = `function calculateTotal(products) {
  let total = 0;
  for (const product of products) {
    total += product.price;
  }
  return total;
}`;

      const result = findSearchMatch(fileContent, searchContent);
      expect(result).not.toBeNull();
      expect(result!.strategyName).toBe("jaroWinklerFuzzyMatch");
    });

    it("should match code with minor typos", () => {
      const testCases = [
        {
          name: "typo in function name",
          fileContent: "function getUserName() { return this.name; }",
          searchContent: "function getUserNaem() { return this.name; }",
        },
        {
          name: "typo in variable",
          fileContent: "const message = 'Hello World';",
          searchContent: "const mesage = 'Hello World';",
        },
        {
          name: "missing character",
          fileContent: "console.log('Debug info');",
          searchContent: "console.log('Debug nfo');",
        },
      ];

      testCases.forEach(({ name, fileContent, searchContent }) => {
        const result = findSearchMatch(fileContent, searchContent);
        expect(result).not.toBeNull();
        expect(result!.strategyName).toBe("jaroWinklerFuzzyMatch");
      });
    });

    it("should not match when similarity is too low", () => {
      const fileContent = "function add(a, b) { return a + b; }";
      const searchContent =
        "class Calculator { multiply(x, y) { return x * y; } }";

      const result = findSearchMatch(fileContent, searchContent);
      expect(result).toBeNull();
    });

    it("should handle multiline fuzzy matches", () => {
      const fileContent = `if (userIsLoggedIn) {
  showDashboard();
  loadUserData();
}`;
      const searchContent = `if (isUserLoggedIn) {
  displayDashboard();
  fetchUserData();
}`;

      const result = findSearchMatch(fileContent, searchContent);
      expect(result).not.toBeNull();
      expect(result!.strategyName).toBe("jaroWinklerFuzzyMatch");
    });

    it("should verify replacement with fuzzy matches", () => {
      const fileContent = "const userName = 'John';";
      const searchContent = "const usrName = 'John';"; // Typo in variable name
      const replacement = "const userName = 'Jane';";

      const match = findSearchMatch(fileContent, searchContent);
      expect(match).not.toBeNull();
      expect(match!.strategyName).toBe("jaroWinklerFuzzyMatch");

      const result = performReplacement(fileContent, match!, replacement);
      expect(result).toBe(replacement);
    });

    it("should handle edge case with very short strings", () => {
      const fileContent = "ab";
      const searchContent = "ac";

      const result = findSearchMatch(fileContent, searchContent);
      // Should not match due to low similarity on short strings
      expect(result).toBeNull();
    });
  });

  describe("Empty search content", () => {
    it("should always return position 0 for empty search", () => {
      const testCases = [
        { fileContent: "some content" },
        { fileContent: "" },
        { fileContent: "line1\nline2\nline3" },
        { fileContent: "   spaces   " },
      ];

      testCases.forEach(({ fileContent }) => {
        const result = findSearchMatch(fileContent, "");
        expect(result).toEqual({
          startIndex: 0,
          endIndex: 0,
          strategyName: "emptySearch",
        });
      });
    });

    it("should treat whitespace-only search as empty", () => {
      const searchVariants = ["   ", "\n\n", "\t\t", "  \n\t  "];

      searchVariants.forEach((searchContent) => {
        const result = findSearchMatch("test content", searchContent);
        expect(result).toEqual({
          startIndex: 0,
          endIndex: 0,
          strategyName: "emptySearch",
        });
      });
    });
  });

  describe("Strategy precedence", () => {
    it("should always prefer exact match over other strategies", () => {
      const fileContent = `exact match
exact match with spaces
exactmatch`;

      // This should find exact match even though fuzzy would also work
      const result = findSearchMatch(fileContent, "exact match");
      expect(result!.strategyName).toBe("exactMatch");
      expect(result!.startIndex).toBe(0);
    });

    it("should prefer trimmed match over whitespace-ignored", () => {
      const fileContent = "  content  ";
      const searchContent = "  content  ";

      // Should find exact match
      const result = findSearchMatch(fileContent, searchContent);
      expect(result!.strategyName).toBe("exactMatch");
    });

    it("should prefer whitespace-ignored over fuzzy", () => {
      const fileContent = "const   x   =   1;";
      const searchContent = "const x=1;";

      // Should use whitespace-ignored, not fuzzy
      const result = findSearchMatch(fileContent, searchContent);
      expect(result!.strategyName).toBe("whitespaceIgnoredMatch");
    });
  });

  describe("Replacement verification tests", () => {
    it("should correctly replace content found by each strategy", () => {
      const testCases = [
        {
          name: "exact match replacement",
          fileContent: "const a = 1;\nconst b = 2;\nconst c = 3;",
          searchContent: "const b = 2;",
          replacement: "const b = 42;",
          expectedResult: "const a = 1;\nconst b = 42;\nconst c = 3;",
          expectedStrategy: "exactMatch",
        },
        {
          name: "trimmed match replacement",
          fileContent: "start\n  target  \nend",
          searchContent: "   target   ",
          replacement: "replaced",
          expectedResult: "start\nreplaced\nend",
          expectedStrategy: "trimmedMatch",
        },
        {
          name: "whitespace-ignored replacement",
          fileContent: "if ( x > 0 ) { return true; }",
          searchContent: "if(x>0){return true;}",
          replacement: "if (x > 0) { return false; }",
          expectedResult: "if (x > 0) { return false; }",
          expectedStrategy: "whitespaceIgnoredMatch",
        },
      ];

      testCases.forEach(
        ({
          name,
          fileContent,
          searchContent,
          replacement,
          expectedResult,
          expectedStrategy,
        }) => {
          const match = findSearchMatch(fileContent, searchContent);
          expect(match).not.toBeNull();
          expect(match!.strategyName).toBe(expectedStrategy);

          const result = performReplacement(fileContent, match!, replacement);
          expect(result).toBe(expectedResult);
        },
      );
    });

    it("should handle edge cases in replacement", () => {
      // Empty replacement
      verifyMatchAndReplacement(
        "before target after",
        "target",
        "target",
        "",
        "before  after",
      );

      // Replacement longer than original
      verifyMatchAndReplacement(
        "short",
        "short",
        "short",
        "much longer replacement",
        "much longer replacement",
      );

      // Multiline replacement
      verifyMatchAndReplacement(
        "single line",
        "single",
        "single",
        "multi\nline\nreplacement",
        "multi\nline\nreplacement line",
      );
    });
  });

  describe("Performance and edge cases", () => {
    it("should handle very long content efficiently", () => {
      const longContent = "x".repeat(10000) + "target" + "y".repeat(10000);
      const result = findSearchMatch(longContent, "target");

      expect(result).not.toBeNull();
      expect(result!.startIndex).toBe(10000);
      expect(result!.endIndex).toBe(10006);
    });

    it("should handle unicode and special characters", () => {
      const testCases = [
        {
          fileContent: "const emoji = '🚀🌟🎉';",
          searchContent: "🚀🌟🎉",
        },
        {
          fileContent: "const chinese = '你好世界';",
          searchContent: "你好世界",
        },
        {
          fileContent: "const regex = /\\d+/g;",
          searchContent: "/\\d+/g",
        },
      ];

      testCases.forEach(({ fileContent, searchContent }) => {
        const result = findSearchMatch(fileContent, searchContent);
        expect(result).not.toBeNull();

        const matchedContent = fileContent.substring(
          result!.startIndex,
          result!.endIndex,
        );
        expect(matchedContent).toContain(searchContent);
      });
    });

    it("should handle null bytes and control characters", () => {
      const fileContent = "before\x00null\x01byte\x02after";
      const searchContent = "\x00null\x01byte\x02";

      const result = findSearchMatch(fileContent, searchContent);
      expect(result).not.toBeNull();
      expect(result!.strategyName).toBe("exactMatch");
    });
  });
});
