import { expect, test } from "vitest";
import { Range } from "..";
import { formatCodeblock } from "./formatCodeblock";

test("formatCodeblock with JavaScript file", () => {
  const result = formatCodeblock("example.js", "const x = 42;");
  expect(result).toBe("```javascript /example.js\nconst x = 42;\n```");
});

test("formatCodeblock with TypeScript file", () => {
  const result = formatCodeblock(
    "util/helper.ts",
    "export const add = (a: number, b: number) => a + b;",
  );
  expect(result).toBe(
    "```typescript /util/helper.ts\nexport const add = (a: number, b: number) => a + b;\n```",
  );
});

test("formatCodeblock with explicit extension override", () => {
  const result = formatCodeblock("example", "SELECT * FROM users;", "sql");
  expect(result).toBe("```sql /example\nSELECT * FROM users;\n```");
});

test("formatCodeblock with Range object", () => {
  const range: Range = {
    start: { line: 4, character: 0 },
    end: { line: 7, character: 10 },
  };
  const result = formatCodeblock(
    "app.py",
    'def hello():\n    return "world"',
    undefined,
    range,
  );
  expect(result).toBe(
    '```python /app.py (5-8)\ndef hello():\n    return "world"\n```',
  );
});

test("formatCodeblock with string range", () => {
  const result = formatCodeblock(
    "app.py",
    'def hello():\n    return "world"',
    undefined,
    "5-10",
  );
  expect(result).toBe(
    '```python /app.py 5-10\ndef hello():\n    return "world"\n```',
  );
});

test("formatCodeblock with absolute path", () => {
  const result = formatCodeblock("/src/main.rs", "fn main() {}\n");
  expect(result).toBe("```rust /src/main.rs\nfn main() {}\n\n```");
});

test("formatCodeblock with unknown extension", () => {
  const result = formatCodeblock("config.xyz", "some: data");
  // Should fall back to using the extension as the language tag
  expect(result).toBe("```xyz /config.xyz\nsome: data\n```");
});

test("formatCodeblock with empty content", () => {
  const result = formatCodeblock("empty.js", "");
  expect(result).toBe("```javascript /empty.js\n\n```");
});

test("formatCodeblock with multiline content", () => {
  const code = `function test() {
  const a = 1;
  const b = 2;
  return a + b;
}`;
  const result = formatCodeblock("test.js", code);
  expect(result).toBe(`\`\`\`javascript /test.js\n${code}\n\`\`\``);
});

test("formatCodeblock trims extra spaces in header", () => {
  const range: Range = {
    start: { line: 0, character: 0 },
    end: { line: 0, character: 0 },
  };
  const result = formatCodeblock("test.js", "const x = 1;", undefined, range);
  // There should be no double spaces in the header
  expect(result).toBe("```javascript /test.js (1-1)\nconst x = 1;\n```");
  expect(result).not.toContain("  ");
});

test("formatCodeblock with no extension", () => {
  const result = formatCodeblock("Dockerfile", "FROM node:14");
  expect(result).toBe("```Dockerfile /Dockerfile\nFROM node:14\n```");
});

test("formatCodeblock with no file extension but explicit language", () => {
  const result = formatCodeblock("README", "# Title", "md");
  expect(result).toBe("```markdown /README\n# Title\n```");
});
