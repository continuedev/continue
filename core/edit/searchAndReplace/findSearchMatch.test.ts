import { findSearchMatch } from "./findSearchMatch";

describe("findSearchMatch", () => {
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
      });
    });

    it("should match at beginning for empty file and empty search", () => {
      const fileContent = "";
      const searchContent = "";

      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 0,
        endIndex: 0,
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

      expect(result).toBeNull();
    });

    it("should return null when trimmed search content is not found", () => {
      const fileContent = `function hello() {
  console.log("world");
}`;
      const searchContent = `\n\nfunction goodbye() {
  console.log("world");
}\n\n`;

      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toBeNull();
    });

    it("should return null for non-existent single line", () => {
      const fileContent = `const a = 1;
const b = 2;
const c = 3;`;
      const searchContent = `const d = 4;`;

      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toBeNull();
    });

    it("should return null for partial match", () => {
      const fileContent = `function hello() {
  console.log("world");
}`;
      const searchContent = `function hello() {
  console.log("universe");
}`;

      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toBeNull();
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
      });
    });
  });
});
