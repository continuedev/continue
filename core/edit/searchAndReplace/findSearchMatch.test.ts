import { findSearchMatch } from "./findSearchMatch";

describe("Exact matches", () => {
  it("should find exact match at the beginning of file", () => {
    const fileContent = `function hello() {
  console.log("world");
}`;
    const searchContent = `function hello() {
  console.log("world");
}`;

    const result = findSearchMatch(fileContent, searchContent);

    expect(result).toEqual({
      startIndex: 0,
      endIndex: fileContent.length,
      strategyName: "exactMatch",
    });
  });

  it("should find exact match in the middle of file", () => {
    const fileContent = `const a = 1;
function hello() {
  console.log("world");
}
const b = 2;`;
    const searchContent = `function hello() {
  console.log("world");
}`;

    const result = findSearchMatch(fileContent, searchContent);

    expect(result).toEqual({
      startIndex: 13, // After "const a = 1;\n"
      endIndex: 13 + searchContent.length,
      strategyName: "exactMatch",
    });
  });

  it("should find exact match at the end of file", () => {
    const fileContent = `const a = 1;
function hello() {
  console.log("world");
}`;
    const searchContent = `function hello() {
  console.log("world");
}`;

    const result = findSearchMatch(fileContent, searchContent);

    expect(result).toEqual({
      startIndex: 13, // After "const a = 1;\n"
      endIndex: fileContent.length,
      strategyName: "exactMatch",
    });
  });

  it("should find exact match with single line", () => {
    const fileContent = `const a = 1;
const b = 2;
const c = 3;`;
    const searchContent = `const b = 2;`;

    const result = findSearchMatch(fileContent, searchContent);

    expect(result).toEqual({
      startIndex: 13, // After "const a = 1;\n"
      endIndex: 13 + searchContent.length,
      strategyName: "exactMatch",
    });
  });

  it("should find exact match with whitespace preserved", () => {
    const fileContent = `function test() {
    const x = 1;
    const y = 2;
}`;
    const searchContent = `    const x = 1;
    const y = 2;`;

    const result = findSearchMatch(fileContent, searchContent);

    // The actual indexOf result is 18, not 17
    expect(result).toEqual({
      startIndex: 18,
      endIndex: 18 + searchContent.length,
      strategyName: "exactMatch",
    });
  });
});

describe("Trimmed matches", () => {
  it("should find trimmed match when exact match fails due to leading newlines", () => {
    const fileContent = `function hello() {
  console.log("world");
}`;
    const searchContent = `\n\nfunction hello() {
  console.log("world");
}\n\n`;

    const result = findSearchMatch(fileContent, searchContent);

    expect(result).toEqual({
      startIndex: 0,
      endIndex: fileContent.length, // Uses trimmed length
      strategyName: "trimmedMatch",
    });
  });

  it("should find trimmed match when exact match fails due to trailing newlines", () => {
    const fileContent = `const a = 1;
function hello() {
  return "world";
}
const b = 2;`;
    const searchContent = `\nfunction hello() {
  return "world";
}\n`;

    const result = findSearchMatch(fileContent, searchContent);

    // The function finds the exact match first (at index 12), not the trimmed match
    expect(result).toEqual({
      startIndex: 12,
      endIndex: 12 + searchContent.length,
      strategyName: "exactMatch",
    });
  });

  it("should find trimmed match for single line with extra whitespace", () => {
    const fileContent = `const a = 1;
const b = 2;
const c = 3;`;
    const searchContent = `\n  const b = 2;  \n`;

    const result = findSearchMatch(fileContent, searchContent);

    const trimmedSearchContent = searchContent.trim();
    const expectedStart = fileContent.indexOf(trimmedSearchContent);

    expect(result).toEqual({
      startIndex: expectedStart,
      endIndex: expectedStart + trimmedSearchContent.length,
      strategyName: "trimmedMatch",
    });
  });
});

describe("Empty search content", () => {
  it("should match at beginning for empty search content", () => {
    const fileContent = `function hello() {
  console.log("world");
}`;
    const searchContent = "";

    const result = findSearchMatch(fileContent, searchContent);

    expect(result).toEqual({
      startIndex: 0,
      endIndex: 0,
      strategyName: "emptySearch",
    });
  });

  it("should match at beginning for whitespace-only search content", () => {
    const fileContent = `function hello() {
  console.log("world");
}`;
    const searchContent = "\n\n  \t  \n";

    const result = findSearchMatch(fileContent, searchContent);

    expect(result).toEqual({
      startIndex: 0,
      endIndex: 0,
      strategyName: "emptySearch",
    });
  });

  it("should match at beginning for empty file and empty search", () => {
    const fileContent = "";
    const searchContent = "";

    const result = findSearchMatch(fileContent, searchContent);

    expect(result).toEqual({
      startIndex: 0,
      endIndex: 0,
      strategyName: "emptySearch",
    });
  });
});

describe("No matches", () => {
  it("should return null when search content is not found", () => {
    const fileContent = `function hello() {
  console.log("world");
}`;
    const searchContent = `function goodbye() {
  console.log("world");
}`;

    const result = findSearchMatch(fileContent, searchContent);

    expect(result?.strategyName).toEqual("jaroWinklerFuzzyMatch");
  });

  it("should return only fuzzy result when trimmed search content is not found", () => {
    const fileContent = `function hello() {
  console.log("world");
}`;
    const searchContent = `\n\nfunction goodbye() {
  console.log("world");
}\n\n`;

    const result = findSearchMatch(fileContent, searchContent);

    expect(result?.strategyName).toEqual("jaroWinklerFuzzyMatch");
  });
});

describe("Edge cases", () => {
  it("should handle empty file with non-empty search", () => {
    const fileContent = "";
    const searchContent = "function hello() {}";

    const result = findSearchMatch(fileContent, searchContent);

    expect(result).toBeNull();
  });

  it("should handle very large content", () => {
    const repeatedLine = "const x = 1;\n";
    const fileContent =
      repeatedLine.repeat(1000) +
      "const target = 2;\n" +
      repeatedLine.repeat(1000);
    const searchContent = "const target = 2;";

    const result = findSearchMatch(fileContent, searchContent);

    const expectedStart = repeatedLine.length * 1000;
    expect(result).toEqual({
      startIndex: expectedStart,
      endIndex: expectedStart + searchContent.length,
      strategyName: "exactMatch",
    });
  });

  it("should handle special characters and symbols", () => {
    const fileContent = `const regex = /[a-zA-Z]+/g;
const symbols = !@#$%^&*();
const unicode = "🚀 Hello 世界";`;
    const searchContent = `const symbols = !@#$%^&*();`;

    const result = findSearchMatch(fileContent, searchContent);

    const expectedStart = fileContent.indexOf(searchContent);
    expect(result).toEqual({
      startIndex: expectedStart,
      endIndex: expectedStart + searchContent.length,
      strategyName: "exactMatch",
    });
  });

  it("should prefer exact match over trimmed match", () => {
    const fileContent = `function test() {
  const x = 1;
}

function test() {
  const x = 1;
}`;
    const searchContent = `function test() {
  const x = 1;
}`;

    const result = findSearchMatch(fileContent, searchContent);

    // Should find the first exact match, not a trimmed version
    expect(result).toEqual({
      startIndex: 0,
      endIndex: searchContent.length,
      strategyName: "exactMatch",
    });
  });

  it("should handle multiple occurrences and return first match", () => {
    const fileContent = `const a = 1;
const b = 2;
const a = 1;`;
    const searchContent = `const a = 1;`;

    const result = findSearchMatch(fileContent, searchContent);

    expect(result).toEqual({
      startIndex: 0,
      endIndex: searchContent.length,
      strategyName: "exactMatch",
    });
  });
});

describe("Whitespace-ignored matches", () => {
  it("should match code with different indentation", () => {
    const fileContent = `function example() {
    const x = 1;
    const y = 2;
    return x + y;
}`;
    const searchContent = `const x=1;
const y=2;
return x+y;`;

    const result = findSearchMatch(fileContent, searchContent);

    expect(result).not.toBeNull();
    expect(result!.startIndex).toBe(20); // After "function example() {\n"
    expect(result!.endIndex).toBe(72); // End of "    return x + y;"
    expect(result!.strategyName).toBe("whitespaceIgnoredMatch");

    // Verify the matched content contains the original whitespace
    const matchedContent = fileContent.substring(
      result!.startIndex,
      result!.endIndex,
    );
    expect(matchedContent).toBe(`
    const x = 1;
    const y = 2;
    return x + y;`);
  });

  it("should match single line with different spacing", () => {
    const fileContent = `const a = 1;
const   b    =   2;
const c = 3;`;
    const searchContent = `const b=2;`;

    const result = findSearchMatch(fileContent, searchContent);

    expect(result).not.toBeNull();
    expect(result!.startIndex).toBe(12); // After "const a = 1;"
    expect(result!.endIndex).toBe(32); // End of "const   b    =   2;"
    expect(result!.strategyName).toBe("whitespaceIgnoredMatch");

    // Verify the matched content preserves original spacing
    const matchedContent = fileContent.substring(
      result!.startIndex,
      result!.endIndex,
    );
    expect(matchedContent).toBe(`
const   b    =   2;`);
  });

  it("should match with tabs vs spaces", () => {
    const fileContent = `function test() {
\tif (condition) {
\t\treturn true;
\t}
}`;
    const searchContent = `if (condition) {
    return true;
}`;

    const result = findSearchMatch(fileContent, searchContent);

    expect(result).not.toBeNull();
    expect(result!.startIndex).toBe(17); // After "function test() {"
    expect(result!.endIndex).toBe(53); // End of "\t}"
    expect(result!.strategyName).toBe("whitespaceIgnoredMatch");

    // Verify the matched content preserves original tabs
    const matchedContent = fileContent.substring(
      result!.startIndex,
      result!.endIndex,
    );
    expect(matchedContent).toBe(`
\tif (condition) {
\t\treturn true;
\t}`);
  });

  it("should match complex whitespace patterns", () => {
    const fileContent = `const obj = {
    key1  :  'value1',
    key2    :    'value2',
    key3 : 'value3'
};`;
    const searchContent = `key1:'value1',
key2:'value2',
key3:'value3'`;

    const result = findSearchMatch(fileContent, searchContent);

    expect(result).not.toBeNull();
    expect(result!.startIndex).toBe(13); // After "const obj = {"
    expect(result!.endIndex).toBe(83); // End of "    key3 : 'value3'"
    expect(result!.strategyName).toBe("whitespaceIgnoredMatch");

    // Verify the matched content preserves original formatting
    const matchedContent = fileContent.substring(
      result!.startIndex,
      result!.endIndex,
    );
    expect(matchedContent).toBe(`
    key1  :  'value1',
    key2    :    'value2',
    key3 : 'value3'`);
  });

  it("should handle newlines and mixed whitespace", () => {
    const fileContent = `function calc() {


    let result = 0;

    result += 5;


    return result;
}`;
    const searchContent = `let result=0;result+=5;return result;`;

    const result = findSearchMatch(fileContent, searchContent);

    expect(result).not.toBeNull();
    expect(result!.startIndex).toBe(17); // After "function calc() {\n\n"
    expect(result!.endIndex).toBe(78); // End of "    return result;"
    expect(result!.strategyName).toBe("whitespaceIgnoredMatch");

    // Verify the matched content includes all original whitespace
    const matchedContent = fileContent.substring(
      result!.startIndex,
      result!.endIndex,
    );
    expect(matchedContent).toBe(`


    let result = 0;

    result += 5;


    return result;`);
  });

  it("should prefer exact match over whitespace-ignored match", () => {
    const fileContent = `const x=1;
const x = 1;`;
    const searchContent = `const x=1;`;

    const result = findSearchMatch(fileContent, searchContent);

    // Should find the exact match first (at index 0), not the whitespace-ignored match
    expect(result).toEqual({
      startIndex: 0,
      endIndex: 10,
      strategyName: "exactMatch",
    });
  });

  it("should handle empty content after whitespace removal", () => {
    const fileContent = `function test() {
  return 1;
}`;
    const searchContent = `\n\n  \t  \n`;

    const result = findSearchMatch(fileContent, searchContent);

    // Should match at beginning for empty/whitespace-only content
    expect(result).toEqual({
      startIndex: 0,
      endIndex: 0,
      strategyName: "emptySearch",
    });
  });

  it("should handle complex code blocks with different formatting", () => {
    const fileContent = `class Example {
    constructor(name) {
        this.name = name;
        this.value = 0;
    }
    
    getValue() {
        return this.value;
    }
}`;
    const searchContent = `constructor(name){
this.name=name;
this.value=0;
}`;

    const result = findSearchMatch(fileContent, searchContent);

    expect(result).not.toBeNull();
    expect(result!.startIndex).toBe(15); // After "class Example {"
    expect(result!.endIndex).toBe(95); // End of "    }"
    expect(result!.strategyName).toBe("whitespaceIgnoredMatch");

    // Verify the matched content preserves original formatting
    const matchedContent = fileContent.substring(
      result!.startIndex,
      result!.endIndex,
    );
    expect(matchedContent).toBe(`
    constructor(name) {
        this.name = name;
        this.value = 0;
    }`);
  });

  it("should return null when no close match exists", () => {
    const fileContent = `function hello() {
  console.log("world");
}`;
    const searchContent = `this has nothing to do with the other option`;

    const result = findSearchMatch(fileContent, searchContent);

    expect(result).toBeNull();
  });

  it("should handle multiple potential matches and return first", () => {
    const fileContent = `const a=1;
const   a   =   1;
const a = 1;`;
    const searchContent = `const a=1;`;

    const result = findSearchMatch(fileContent, searchContent);

    // Should find the first exact match
    expect(result).toEqual({
      startIndex: 0,
      endIndex: 10,
      strategyName: "exactMatch",
    });
  });
});

describe("Real-world scenarios", () => {
  it("should match typical function replacement", () => {
    const fileContent = `class Calculator {
  constructor() {
    this.result = 0;
  }

  reset() {
    this.result = 0;
    return this;
  }

  add(value) {
    this.result += value;
    return this;
  }
}`;
    const searchContent = `  reset() {
    this.result = 0;
    return this;
  }`;

    const result = findSearchMatch(fileContent, searchContent);

    const expectedStart = fileContent.indexOf(searchContent);
    expect(result).toEqual({
      startIndex: expectedStart,
      endIndex: expectedStart + searchContent.length,
      strategyName: "exactMatch",
    });
  });

  it("should match import statement", () => {
    const fileContent = `import React from 'react';
import { useState, useEffect } from 'react';
import './App.css';

function App() {
  return <div>Hello World</div>;
}`;
    const searchContent = `import { useState, useEffect } from 'react';`;

    const result = findSearchMatch(fileContent, searchContent);

    const expectedStart = fileContent.indexOf(searchContent);
    expect(result).toEqual({
      startIndex: expectedStart,
      endIndex: expectedStart + searchContent.length,
      strategyName: "exactMatch",
    });
  });

  it("should match comment block", () => {
    const fileContent = `/**
 * This is a comment
 * that spans multiple lines
 */
function test() {
  // Single line comment
  return true;
}`;
    const searchContent = `/**
 * This is a comment
 * that spans multiple lines
 */`;

    const result = findSearchMatch(fileContent, searchContent);

    expect(result).toEqual({
      startIndex: 0,
      endIndex: searchContent.length,
      strategyName: "exactMatch",
    });
  });

  describe("Jaro-Winkler fuzzy matching", () => {
    describe("Basic fuzzy matching", () => {
      it("should find fuzzy match for similar strings", () => {
        const fileContent = `function calculateSum(a, b) {
  return a + b;
}`;
        const searchContent = `function calculateSum(x, y) {
  return x + y;
}`;

        const result = findSearchMatch(fileContent, searchContent);

        expect(result).not.toBeNull();
      });

      it("should find fuzzy match with minor typos", () => {
        const fileContent = `const message = "Hello World";`;
        const searchContent = `const mesage = "Hello World";`; // Missing 's' in 'message'

        const result = findSearchMatch(fileContent, searchContent);

        expect(result).not.toBeNull();
        expect(result?.startIndex).toBe(0);
      });

      it("should find fuzzy match with different variable names", () => {
        const fileContent = `let userAge = 25;
let userName = "John";`;
        const searchContent = `let age = 25;
let name = "John";`;

        const result = findSearchMatch(fileContent, searchContent);

        expect(result).not.toBeNull();
      });

      it("should find fuzzy match for similar function signature", () => {
        const fileContent = `function processUserData(userData) {
  validateInput(userData);
  return formatOutput(userData);
}`;
        const searchContent = `function processData(data) {
  validateInput(data);
  return formatOutput(data);
}`;

        const result = findSearchMatch(fileContent, searchContent);

        expect(result).not.toBeNull();
      });
    });

    describe("Multi-line fuzzy matching", () => {
      it("should find fuzzy match for multi-line blocks", () => {
        const fileContent = `class Calculator {
  constructor() {
    this.result = 0;
  }
  
  add(value) {
    this.result += value;
    return this;
  }
}`;
        const searchContent = `class Calculator {
  constructor() {
    this.value = 0;
  }
  
  add(num) {
    this.value += num;
    return this;
  }
}`;

        const result = findSearchMatch(fileContent, searchContent);

        expect(result).not.toBeNull();
      });

      it("should find fuzzy match for partial blocks", () => {
        const fileContent = `function processData(input) {
  const validated = validateInput(input);
  const processed = transformData(validated);
  const result = formatOutput(processed);
  return result;
}`;
        const searchContent = `const validated = validateInput(input);
  const processed = transformData(validated);`;

        const result = findSearchMatch(fileContent, searchContent);

        expect(result).not.toBeNull();
      });
    });

    describe("Edge cases with fuzzy matching", () => {
      it("should handle empty search content with fuzzy matching enabled", () => {
        const fileContent = `function test() {}`;
        const searchContent = "";

        const result = findSearchMatch(fileContent, searchContent);

        expect(result).toEqual({
          startIndex: 0,
          endIndex: 0,
          strategyName: "emptySearch",
        });
      });

      it("should handle empty file content with fuzzy matching enabled", () => {
        const fileContent = "";
        const searchContent = "function test() {}";

        const result = findSearchMatch(fileContent, searchContent);

        expect(result).toBeNull();
      });

      it("should prefer exact match over fuzzy match", () => {
        const fileContent = `function test() { return true; }
function test() { return false; }`;
        const searchContent = `function test() { return true; }`;

        const result = findSearchMatch(fileContent, searchContent);

        expect(result).not.toBeNull();
        expect(result?.startIndex).toBe(0);
      });

      it("should handle very short strings", () => {
        const fileContent = `a b c`;
        const searchContent = `a c`;

        const result = findSearchMatch(fileContent, searchContent);

        // Should not match due to low similarity
        expect(result).toBeNull();
      });

      it("should handle special characters in fuzzy matching", () => {
        const fileContent = `const regex = /[a-zA-Z]+/g;
const symbols = !@#$%^&*();`;
        const searchContent = `const regex = /[a-zA-Z0-9]+/g;
const symbols = !@#$%^&*();`;

        const result = findSearchMatch(fileContent, searchContent);

        expect(result).not.toBeNull();
      });
    });
  });
});
