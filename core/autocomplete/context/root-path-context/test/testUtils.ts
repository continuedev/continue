import fs from "fs";
import path from "path";
import { jest } from "@jest/globals";

import { Range } from "../../../..";
import { testIde } from "../../../../test/util/fixtures";
import { getAst, getTreePathAtCursor } from "../../../util/ast";
import { ImportDefinitionsService } from "../../ImportDefinitionsService";
import { RootPathContextService } from "../RootPathContextService";
import Parser from "web-tree-sitter";

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
  expectedDefinitionPositions: Parser.Point[],
) {
  // Create a mocked instance of RootPathContextService
  const ide = testIde;
  const importDefinitionsService = new ImportDefinitionsService(ide);
  const service = new RootPathContextService(importDefinitionsService, ide);

  const getSnippetsMock = jest
    // @ts-ignore
    .spyOn(service, "getSnippets")
    // @ts-ignore
    .mockImplementation(async (_filepath, _endPosition) => {
      return [];
    });

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

  const treePath = await getTreePathAtCursor(ast, prefix.length);
  await service.getContextForPath(startPath, treePath);

  expect(getSnippetsMock).toHaveBeenCalledTimes(
    expectedDefinitionPositions.length,
  );

  expectedDefinitionPositions.forEach((position, index) => {
    expect(getSnippetsMock).toHaveBeenNthCalledWith(
      index + 1,
      expect.any(String), // filepath argument
      position,
    );
  });
}
