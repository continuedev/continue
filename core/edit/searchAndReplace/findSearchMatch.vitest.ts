import { describe, expect, it } from "vitest";
import { findSearchMatch } from "./findSearchMatch";

describe("findSearchMatch", () => {
  describe("Empty search content", () => {
    it("should return position 0 for empty string", () => {
      const result = findSearchMatch("some file content", "");
      expect(result).toEqual({
        startIndex: 0,
        endIndex: 0,
        strategyName: "emptySearch",
      });
    });

    it("should return position 0 for whitespace-only string", () => {
      const result = findSearchMatch("some file content", "   \n\t  ");
      expect(result).toEqual({
        startIndex: 0,
        endIndex: 0,
        strategyName: "emptySearch",
      });
    });

    it("should handle empty file content with empty search", () => {
      const result = findSearchMatch("", "");
      expect(result).toEqual({
        startIndex: 0,
        endIndex: 0,
        strategyName: "emptySearch",
      });
    });
  });

  describe("Exact match strategy", () => {
    it("should find exact match at beginning of file", () => {
      const fileContent = "hello world";
      const searchContent = "hello";
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 0,
        endIndex: 5,
        strategyName: "exactMatch",
      });
    });

    it("should find exact match in middle of file", () => {
      const fileContent = "hello world test";
      const searchContent = "world";
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 6,
        endIndex: 11,
        strategyName: "exactMatch",
      });
    });

    it("should find exact match at end of file", () => {
      const fileContent = "hello world";
      const searchContent = "world";
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 6,
        endIndex: 11,
        strategyName: "exactMatch",
      });
    });

    it("should find multi-line exact match", () => {
      const fileContent = "line1\nline2\nline3";
      const searchContent = "line2\nline3";
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 6,
        endIndex: 17,
        strategyName: "exactMatch",
      });
    });

    it("should handle exact match with special characters", () => {
      const fileContent = 'function test() { return "hello"; }';
      const searchContent = '{ return "hello"; }';
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 16,
        endIndex: 35,
        strategyName: "exactMatch",
      });
    });

    it("should find first occurrence when multiple matches exist", () => {
      const fileContent = "test test test";
      const searchContent = "test";
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 0,
        endIndex: 4,
        strategyName: "exactMatch",
      });
    });

    it("should handle case-sensitive matching", () => {
      const fileContent = "Hello World";
      const searchContent = "hello";
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 0,
        endIndex: 5,
        strategyName: "caseInsensitiveMatch",
      });
    });
  });

  describe("Trimmed match strategy fallback", () => {
    it("should find match when search content has leading/trailing whitespace", () => {
      const fileContent = "hello world";
      const searchContent = "  hello  ";
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 0,
        endIndex: 5,
        strategyName: "trimmedMatch",
      });
    });

    it("should find match when search content has tabs and newlines", () => {
      const fileContent = "function test() {}";
      const searchContent = "\t\nfunction test()\n\t";
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 0,
        endIndex: 15,
        strategyName: "trimmedMatch",
      });
    });

    it("should handle complex whitespace trimming", () => {
      const fileContent = "const x = 5;";
      const searchContent = "   \n\t  const x = 5;  \t\n  ";
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 0,
        endIndex: 12,
        strategyName: "trimmedMatch",
      });
    });
  });

  describe("Case insensitive match strategy fallback", () => {
    it("should match when case differs", () => {
      const result = findSearchMatch(
        "const myVariable = 42;",
        "const MYVARIABLE = 42;",
      );
      expect(result).toEqual({
        startIndex: 0,
        endIndex: 22,
        strategyName: "caseInsensitiveMatch",
      });
    });

    it("should match mixed case in middle of file", () => {
      const result = findSearchMatch(
        "function HandleClick() {",
        "function handleclick() {",
      );
      expect(result).toEqual({
        startIndex: 0,
        endIndex: 24,
        strategyName: "caseInsensitiveMatch",
      });
    });
  });

  describe("Whitespace ignored strategy fallback", () => {
    it("should match content with different whitespace formatting", () => {
      const fileContent = "function test() {\n  return true;\n}";
      const searchContent = "function test(){return true;}";
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 0,
        endIndex: 34,
        strategyName: "whitespaceIgnoredMatch",
      });
    });

    it("should handle mixed whitespace differences", () => {
      const fileContent = "if (condition) {\n    doSomething();\n}";
      const searchContent = "if(condition){doSomething();}";
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 0,
        endIndex: 37,
        strategyName: "whitespaceIgnoredMatch",
      });
    });

    it("should match with tabs vs spaces differences", () => {
      const fileContent = "function test() {\n\treturn 42;\n}";
      const searchContent = "function test() {\n    return 42;\n}";
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 0,
        endIndex: 31,
        strategyName: "whitespaceIgnoredMatch",
      });
    });

    it("should handle partial matches within larger content", () => {
      const fileContent = "before\nfunction test() {\n  return true;\n}\nafter";
      const searchContent = "function test(){return true;}";
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 7,
        endIndex: 41,
        strategyName: "whitespaceIgnoredMatch",
      });
    });

    it("should recognize empty search", () => {
      const fileContent = "some content";
      const searchContent = "   \t\n   ";
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 0,
        endIndex: 0,
        strategyName: "emptySearch",
      });
    });

    it("should handle complex nested structures with whitespace differences", () => {
      const fileContent = `{
  "key": "value",
  "nested": {
    "prop": 123
  }
}`;
      const searchContent = '{"key":"value","nested":{"prop":123}}';
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 0,
        endIndex: 55,
        strategyName: "whitespaceIgnoredMatch",
      });
    });

    it("should match content in middle of file with complex indentation", () => {
      const fileContent = `import React from 'react';

function MyComponent() {
  const handleClick = () => {
    console.log('clicked');
  };
  return <button onClick={handleClick}>Click me</button>;
}

export default MyComponent;`;
      const searchContent = `const handleClick=()=>{console.log('clicked');};`;
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 55,
        endIndex: 115,
        strategyName: "whitespaceIgnoredMatch",
      });
    });

    it("should handle matches with mixed line endings and special characters", () => {
      const fileContent = `<!DOCTYPE html>\r\n<html>\r\n  <body>\r\n    <div id="app">\r\n      <p>Hello & goodbye</p>\r\n    </div>\r\n  </body>\r\n</html>`;
      const searchContent = `<divid="app"><p>Hello&goodbye</p></div>`;
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 39,
        endIndex: 95,
        strategyName: "whitespaceIgnoredMatch",
      });
    });

    it("should match content surrounded by different types of whitespace", () => {
      const fileContent = `\tconst data = {\n\t\tname: "John",\n\t\tage: 30,\n\t\taddress: {\n\t\t\tstreet: "Main St",\n\t\t\tcity: "NYC"\n\t\t}\n\t};`;
      const searchContent = `address:{street:"MainSt",city:"NYC"}`;
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 45,
        endIndex: 96,
        strategyName: "whitespaceIgnoredMatch",
      });
    });

    // IMPORTANT string.length and string.slice both count UTF-16 units so emojis will count as 2 in both
    it("should handle unicode characters with whitespace differences", () => {
      const fileContent = `const message = {\n  greeting: "Hello 👋",\n  emoji: "🚀",\n  unicode: "café",\n  symbol: "∑"\n};`;
      const searchContent = `emoji:"🚀",unicode:"café",symbol:"∑"`;
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 44,
        endIndex: 89,
        strategyName: "whitespaceIgnoredMatch",
      });
    });

    it("should match across multiple nested blocks with varying indentation", () => {
      const fileContent = `class Calculator {\n    add(a, b) {\n        if (typeof a === 'number' && typeof b === 'number') {\n            return a + b;\n        }\n        throw new Error('Invalid input');\n    }\n\n    multiply(x, y) {\n        return x * y;\n    }\n}`;
      const searchContent = `if(typeofa==='number'&&typeofb==='number'){returna+b;}`;
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 43,
        endIndex: 132,
        strategyName: "whitespaceIgnoredMatch",
      });
    });

    it("should handle regex-like patterns with escaped characters", () => {
      const fileContent = `const pattern = /\\d+\\.\\d+/g;\nconst test = \"123.456\";\nif (pattern.test(test)) {\n  console.log(\"Match found\");\n}`;
      const searchContent = `consttest="123.456";if(pattern.test(test)){console.log("Matchfound");}`;
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 29,
        endIndex: 110,
        strategyName: "whitespaceIgnoredMatch",
      });
    });

    it("should match SQL-like content with varying whitespace", () => {
      const fileContent = `SELECT users.name,\n       users.email,\n       profiles.bio\nFROM users\nINNER JOIN profiles ON users.id = profiles.user_id\nWHERE users.active = true\nORDER BY users.name;`;
      const searchContent = `SELECTusers.name,users.email,profiles.bioFROMusersINNERJOINprofiles`;
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 0,
        endIndex: 89,
        strategyName: "whitespaceIgnoredMatch",
      });
    });

    it("should handle content with form feeds, vertical tabs, and other rare whitespace", () => {
      const fileContent = `function\fprocess\vdata(input)\u0020{\u00A0\n\treturn\u2000input.trim();\u2009\n}`;
      const searchContent = `functionprocessdata(input){returninput.trim();}`;
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 0,
        endIndex: 56,
        strategyName: "whitespaceIgnoredMatch",
      });
    });

    it("should match content with Windows-style CRLF line endings", () => {
      const fileContent = `@echo off\r\nset PATH=%PATH%;C:\\tools\r\nif \"%1\"==\"\" (\r\n    echo Usage: script.bat filename\r\n    exit /b 1\r\n)\r\necho Processing %1...\r\necho Done.`;
      const searchContent = `if\"%1\"==\"\"(echo Usage: script.bat filename exit/b 1)`;
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 37,
        endIndex: 105,
        strategyName: "whitespaceIgnoredMatch",
      });
    });

    it("should handle deeply nested JSON with mixed formatting", () => {
      const fileContent = `{\n  \"config\": {\n    \"database\": {\n      \"host\": \"localhost\",\n      \"port\": 5432,\n      \"credentials\": {\n        \"username\": \"admin\",\n        \"password\": \"secret\"\n      },\n      \"options\": {\n        \"ssl\": true,\n        \"timeout\": 30000\n      }\n    }\n  }\n}`;
      const searchContent = `\"credentials\":{\"username\":\"admin\",\"password\":\"secret\"},\"options\":{\"ssl\":true,\"timeout\":30000}`;
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 87,
        endIndex: 243,
        strategyName: "whitespaceIgnoredMatch",
      });
    });

    it("should match XML content with attribute spacing differences", () => {
      const fileContent = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<root>\n  <item id = \"1\"   type= \"primary\" >\n    <name>Test Item</name>\n    <value   unit=\"px\" >100</value>\n  </item>\n</root>`;
      const searchContent = `<itemid=\"1\"type=\"primary\"><name>TestItem</name><valueunit=\"px\">100</value></item>`;
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 48,
        endIndex: 155,
        strategyName: "whitespaceIgnoredMatch",
      });
    });

    it("should handle mathematical expressions with varying spacing", () => {
      const fileContent = `const result = (a + b) * c - d / e;\nconst complex = Math.sqrt(  x ** 2   +   y ** 2  );\nconst formula = ( ( a + b ) * ( c - d ) ) / ( e + f );`;
      const searchContent = `constcomplex=Math.sqrt(x**2+y**2);constformula=((a+b)*(c-d))/(e+f);`;
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 36,
        endIndex: 142,
        strategyName: "whitespaceIgnoredMatch",
      });
    });

    it("should match across comments and code with whitespace variations", () => {
      const fileContent = `/* Multi-line comment\n   with varying indentation */\nfunction processData(input) {\n    // Single line comment\n    const cleaned = input.trim();\n    /* Another comment */\n    return cleaned.toLowerCase();\n}`;
      const searchContent = `/*Multi-linecommentwithvaryingindentation*/functionprocessData(input){//Singlelinecommentconstcleaned=input.trim();/*Anothercomment*/returncleaned.toLowerCase();}`;
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 0,
        endIndex: 205,
        strategyName: "whitespaceIgnoredMatch",
      });
    });
  });

  describe("No match scenarios", () => {
    it("should return null when no strategy finds a match", () => {
      const fileContent = "hello world";
      const searchContent = "goodbye";
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toBeNull();
    });

    it("should return null for completely different content", () => {
      const fileContent = "function test() { return true; }";
      const searchContent = "class MyClass { }";
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toBeNull();
    });

    it("should return null when search content is longer than file content", () => {
      const fileContent = "short";
      const searchContent = "this is much longer than the file content";
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toBeNull();
    });
  });

  describe("Edge cases", () => {
    it("should handle empty file content with non-empty search", () => {
      const fileContent = "";
      const searchContent = "something";
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toBeNull();
    });

    it("should handle single character matches", () => {
      const fileContent = "a";
      const searchContent = "a";
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 0,
        endIndex: 1,
        strategyName: "exactMatch",
      });
    });

    it("should handle unicode characters", () => {
      const fileContent = "Hello 🌍 World";
      const searchContent = "🌍";
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 6,
        endIndex: 8, // Unicode emoji takes 2 character positions
        strategyName: "exactMatch",
      });
    });

    it("should handle newlines and carriage returns", () => {
      const fileContent = "line1\r\nline2\nline3";
      const searchContent = "\r\nline2";
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 5,
        endIndex: 12,
        strategyName: "exactMatch",
      });
    });

    it("should handle very long content efficiently", () => {
      const longContent = "a".repeat(10000) + "target" + "b".repeat(10000);
      const searchContent = "target";
      const result = findSearchMatch(longContent, searchContent);

      expect(result).toEqual({
        startIndex: 10000,
        endIndex: 10006,
        strategyName: "exactMatch",
      });
    });
  });

  describe("Strategy precedence", () => {
    it("should prefer exact match over trimmed match", () => {
      const fileContent = "hello world hello";
      const searchContent = "hello"; // This exists exactly, so should use exactMatch
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 0,
        endIndex: 5,
        strategyName: "exactMatch",
      });
    });

    it("should prefer trimmed match over whitespace ignored match", () => {
      // Set up content where trimmed match would work but whitespace ignored would also work
      const fileContent = "hello world";
      const searchContent = "  hello  "; // Has whitespace but trimmed version exists
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 0,
        endIndex: 5,
        strategyName: "trimmedMatch",
      });
    });

    it("should fall back through strategies in correct order", () => {
      const fileContent = "function test() {\n  return true;\n}";
      const searchContent = "  function test(){return true;}  "; // Needs whitespace ignored
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 0,
        endIndex: 34,
        strategyName: "whitespaceIgnoredMatch",
      });
    });
  });

  describe("Real-world code examples", () => {
    it("should handle JavaScript function matching", () => {
      const fileContent = `function calculateSum(a, b) {
  const result = a + b;
  return result;
}`;
      const searchContent = `function calculateSum(a, b) {
  const result = a + b;
  return result;
}`;
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 0,
        endIndex: 72,
        strategyName: "exactMatch",
      });
    });

    it("should handle HTML tag matching with different formatting", () => {
      const fileContent = `<div class="container">
  <p>Hello World</p>
</div>`;
      const searchContent = `<div class="container"><p>Hello World</p></div>`;
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 0,
        endIndex: 51,
        strategyName: "whitespaceIgnoredMatch",
      });
    });

    it("should handle CSS rule matching", () => {
      const fileContent = `.button {
  background-color: blue;
  color: white;
}`;
      const searchContent = `.button{background-color:blue;color:white;}`;
      const result = findSearchMatch(fileContent, searchContent);

      expect(result).toEqual({
        startIndex: 0,
        endIndex: 53,
        strategyName: "whitespaceIgnoredMatch",
      });
    });
  });
});
