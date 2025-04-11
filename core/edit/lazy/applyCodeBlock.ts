import { DiffLine, ILLM } from "../..";
import { generateLines } from "../../diff/util";
import { supportedLanguages } from "../../util/treeSitter";
import { getUriFileExtension } from "../../util/uri";

import { streamLazyApply } from "./streamLazyApply";
import { applyUnifiedDiff, isUnifiedDiffFormat } from "./unifiedDiffApply";

function canUseInstantApply(filename: string) {
  const fileExtension = getUriFileExtension(filename);
  return supportedLanguages[fileExtension] !== undefined;
}

export async function applyCodeBlock(
  oldFile: string,
  newFile: string,
  filename: string,
  llm: ILLM,
): Promise<[boolean, AsyncGenerator<DiffLine>]> {
  // This was buggy, removed for now, maybe forever
  // if (canUseInstantApply(filename)) {
  //   const diffLines = await deterministicApplyLazyEdit(
  //     oldFile,
  //     newFile,
  //     filename,
  //   );

  //   // Fall back to LLM method if we couldn't apply deterministically
  //   if (diffLines !== undefined) {
  //     const diffGenerator = generateLines(diffLines!);
  //     return [true, diffGenerator];
  //   }
  // }

  // If the code block is a diff
  if (isUnifiedDiffFormat(newFile)) {
    try {
      const diffLines = applyUnifiedDiff(oldFile, newFile);
      const diffGenerator = generateLines(diffLines!);
      return [true, diffGenerator];
    } catch (e) {
      console.error("Failed to apply unified diff", e);
    }
  }

  return [false, streamLazyApply(oldFile, filename, newFile, llm)];
}
