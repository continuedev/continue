import { DiffLine } from "../..";
import { streamDiff } from "../../diff/streamDiff";
import { SearchMatchResult } from "./findSearchMatch";

/**
 * Generates a stream of DiffLine objects for a search and replace operation.
 * Uses the existing streamDiff algorithm to calculate the actual differences.
 *
 * @param fileContent - The complete content of the file
 * @param searchMatch - The match result with start/end character positions
 * @param replaceContent - The content to replace the matched section with
 * @returns AsyncGenerator of DiffLine objects for streaming to VerticalDiffManager
 */
export async function* generateSearchReplaceDiffLines(
  fileContent: string,
  searchMatch: SearchMatchResult,
  replaceContent: string,
): AsyncGenerator<DiffLine> {
  // Apply the replacement to get the new file content
  const newFileContent =
    fileContent.substring(0, searchMatch.startIndex) +
    replaceContent +
    fileContent.substring(searchMatch.endIndex);

  // Split into lines for the diff algorithm
  const oldLines = fileContent.split("\n");
  const newLines = newFileContent.split("\n");

  // Create a simple async generator for the new lines
  // Don't use streamLines since we already have complete lines
  async function* newLinesGenerator() {
    for (const line of newLines) {
      yield line;
    }
  }

  // Stream the diff using existing infrastructure
  yield* streamDiff(oldLines, newLinesGenerator());
}
