import { SearchMatchResult } from "./findSearchMatch";
import { generateSearchReplaceDiffLines } from "./generateSearchReplaceDiffLines";

describe("generateSearchReplaceDiffLines", () => {
  async function collectDiffLines(generator: AsyncGenerator<any>) {
    const lines = [];
    for await (const line of generator) {
      lines.push(line);
    }
    return lines;
  }

  it("should generate valid diff lines", async () => {
    const fileContent = `const a = 1;
const b = 2;
const c = 3;`;

    const searchMatch: SearchMatchResult = {
      startIndex: 13, // Start of "const b = 2;"
      endIndex: 25, // End of "const b = 2;"
    };

    const replaceContent = "const b = 42;";

    const diffLines = await collectDiffLines(
      generateSearchReplaceDiffLines(fileContent, searchMatch, replaceContent),
    );

    // Verify we get valid diff lines
    expect(diffLines.length).toBeGreaterThan(0);

    // Verify all lines have valid types
    diffLines.forEach((line) => {
      expect(["old", "new", "same"]).toContain(line.type);
      expect(typeof line.line).toBe("string");
    });

    // Verify we have both old and new lines (indicating a change)
    const hasOldLines = diffLines.some((line) => line.type === "old");
    const hasNewLines = diffLines.some((line) => line.type === "new");
    expect(hasOldLines).toBe(true);
    expect(hasNewLines).toBe(true);
  });

  it("should handle empty replacement (deletion)", async () => {
    const fileContent = `const a = 1;
const b = 2;
const c = 3;`;

    const searchMatch: SearchMatchResult = {
      startIndex: 12, // Start of "\nconst b = 2;"
      endIndex: 25, // End of "const b = 2;"
    };

    const replaceContent = "";

    const diffLines = await collectDiffLines(
      generateSearchReplaceDiffLines(fileContent, searchMatch, replaceContent),
    );

    // Should have old lines for the deleted content
    expect(diffLines.length).toBeGreaterThan(0);
    const hasOldLines = diffLines.some((line) => line.type === "old");
    expect(hasOldLines).toBe(true);
  });
  it("should handle whole file replacement", async () => {
    const fileContent = `old content`;
    const searchMatch: SearchMatchResult = {
      startIndex: 0,
      endIndex: fileContent.length,
    };

    const replaceContent = `completely new content`;
    const diffLines = await collectDiffLines(
      generateSearchReplaceDiffLines(fileContent, searchMatch, replaceContent),
    );

    // Should have both old and new lines
    const hasOldLines = diffLines.some((line) => line.type === "old");
    const hasNewLines = diffLines.some((line) => line.type === "new");
    expect(hasOldLines).toBe(true);
    expect(hasNewLines).toBe(true);
  });

  it("should handle empty file with insertion", async () => {
    const fileContent = "";
    const searchMatch: SearchMatchResult = {
      startIndex: 0,
      endIndex: 0,
    };

    const replaceContent = `new content
second line`;

    const diffLines = await collectDiffLines(
      generateSearchReplaceDiffLines(fileContent, searchMatch, replaceContent),
    );

    // Should have new lines for the inserted content
    expect(diffLines.length).toBeGreaterThan(0);
    const hasNewLines = diffLines.some((line) => line.type === "new");
    expect(hasNewLines).toBe(true);

    // Note: Empty file split by newlines gives [''] so there will be one "old" empty line
    // This is correct behavior from the diff algorithm's perspective
  });

  it("should produce correct final content when applied", async () => {
    const fileContent = `line1
line2
line3`;

    const searchMatch: SearchMatchResult = {
      startIndex: 6, // Start of "line2"
      endIndex: 11, // End of "line2"
    };

    const replaceContent = "replaced";

    // The expected final content
    const expectedContent =
      fileContent.substring(0, searchMatch.startIndex) +
      replaceContent +
      fileContent.substring(searchMatch.endIndex);

    const diffLines = await collectDiffLines(
      generateSearchReplaceDiffLines(fileContent, searchMatch, replaceContent),
    );

    // Reconstruct content from diff lines
    const newLines = diffLines
      .filter((line) => line.type === "new" || line.type === "same")
      .map((line) => line.line);

    const reconstructedContent = newLines.join("\n");

    // Should exactly match expected content, including line structure
    expect(reconstructedContent).toBe(expectedContent);

    // Also verify we have the correct number of lines
    expect(newLines).toEqual(["line1", "replaced", "line3"]);
  });
});
