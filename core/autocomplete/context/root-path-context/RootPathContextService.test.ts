import fs from "fs";
import path from "path";
import { Range } from "../../..";
import { testIde } from "../../../test/util/fixtures";
import { getAst, getTreePathAtCursor } from "../../util/ast";
import { ImportDefinitionsService } from "../ImportDefinitionsService";
import { RootPathContextService } from "./RootPathContextService";

function splitTextAtRange(fileContent: string, range: Range): [string, string] {
  const lines = fileContent.split("\n");
  let currentPos = 0;

  if (range.start.line === range.end.line) {
    // If range is on the same line, calculate position once
    for (let i = 0; i < range.start.line; i++) {
      currentPos += lines[i].length + 1; // +1 for the newline character
    }
    const startPos = currentPos + range.start.character;
    const endPos = currentPos + range.end.character;
    return [fileContent.slice(0, startPos), fileContent.slice(endPos)];
  }

  // Calculate position of range start
  for (let i = 0; i < range.start.line; i++) {
    currentPos += lines[i].length + 1;
  }
  const startPos = currentPos + range.start.character;

  // Calculate position of range end
  currentPos = 0;
  for (let i = 0; i < range.end.line; i++) {
    currentPos += lines[i].length + 1;
  }
  const endPos = currentPos + range.end.character;

  return [fileContent.slice(0, startPos), fileContent.slice(endPos)];
}

export async function testRootPathContext(
  folderName: string,
  relativeFilepath: string,
  rangeToFill: Range,
  expectedSnippets: string[],
) {
  const ide = testIde;
  const importDefinitionsService = new ImportDefinitionsService(ide);
  const service = new RootPathContextService(importDefinitionsService, ide);

  // Copy the folder to the test directory
  const folderPath = path.join(
    __dirname,
    "autocomplete",
    "context",
    "root-path-context",
    "test",
    folderName,
  );
  const workspaceDir = (await ide.getWorkspaceDirs())[0];
  const testFolderPath = path.join(workspaceDir, folderName);
  fs.cpSync(folderPath, testFolderPath, {
    recursive: true,
    force: true,
  });

  // Get results of root path context
  const startPath = path.join(testFolderPath, relativeFilepath);
  const [prefix, suffix] = splitTextAtRange(
    fs.readFileSync(startPath, "utf8"),
    rangeToFill,
  );
  const fileContents = prefix + suffix;
  const ast = await getAst(startPath, fileContents);
  if (!ast) {
    throw new Error("AST is undefined");
  }

  const treePath = await getTreePathAtCursor(ast, rangeToFill.start.character);
  const snippets = await service.getContextForPath(startPath, treePath);

  expectedSnippets.forEach((expectedSnippet) => {
    const found = snippets.find((snippet) =>
      snippet.contents.includes(expectedSnippet),
    );
    expect(found).toBeDefined();
  });
}

describe("RootPathContextService", () => {
  it("should be true", async () => {
    await testRootPathContext(
      "typescript",
      "file1.ts",
      { start: { line: 3, character: 2 }, end: { line: 3, character: 24 } },
      ["export interface Person", "export interface Address"],
    );
  });
});
