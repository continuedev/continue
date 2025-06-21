import fs from "fs";
import path from "path";
import { expect, vi } from "vitest";

import Parser from "web-tree-sitter";
import { Position } from "../../../..";
import { testIde } from "../../../../test/fixtures";
import { getAst, getTreePathAtCursor } from "../../../util/ast";
import { ImportDefinitionsService } from "../../ImportDefinitionsService";
import { RootPathContextService } from "../RootPathContextService";

function splitTextAtPosition(
  fileContent: string,
  position: Position,
): [string, string] {
  const lines = fileContent.split("\n");
  let currentPos = 0;

  // Calculate position based on the provided line and character
  for (let i = 0; i < position.line; i++) {
    currentPos += lines[i].length + 1; // +1 for the newline character
  }
  const splitPos = currentPos + position.character;

  return [fileContent.slice(0, splitPos), fileContent.slice(splitPos)];
}

export async function testRootPathContext(
  folderName: string,
  relativeFilepath: string,
  position: Position,
  expectedDefinitionPositions: Parser.Point[],
) {
  // Create a mocked instance of RootPathContextService
  const ide = testIde;
  const importDefinitionsService = new ImportDefinitionsService(ide);
  const service = new RootPathContextService(importDefinitionsService, ide);

  const getSnippetsMock = vi
    // @ts-ignore
    .spyOn(service, "getSnippets")
    // @ts-ignore
    .mockImplementation((_filePath, _endPosition) => {
      return [];
    });

  // Copy the folder to the test directory
  const folderPath = path.join(
    process.cwd(),
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
  const [prefix, suffix] = splitTextAtPosition(
    fs.readFileSync(startPath, "utf8"),
    position,
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
      expect.any(String), // language argument
    );
  });
}
