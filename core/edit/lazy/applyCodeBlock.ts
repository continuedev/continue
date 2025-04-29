import { DiffLine, ILLM } from "../..";
import { generateLines } from "../../diff/util";
import { supportedLanguages } from "../../util/treeSitter";
import { getUriFileExtension } from "../../util/uri";
import { deterministicApplyLazyEdit } from "./deterministic";
import { streamLazyApply } from "./streamLazyApply";
import { applyUnifiedDiff, isUnifiedDiffFormat } from "./unifiedDiffApply";

function canUseInstantApply(filename: string) {
  const fileExtension = getUriFileExtension(filename);
  return supportedLanguages[fileExtension] !== undefined;
}

export async function applyCodeBlock(
  oldFile: string,
  newLazyFile: string,
  filename: string,
  llm: ILLM,
): Promise<{
  isInstantApply: boolean;
  diffLinesGenerator: AsyncGenerator<DiffLine>;
}> {
  if (canUseInstantApply(filename)) {
    const diffLines = await deterministicApplyLazyEdit({
      oldFile,
      newLazyFile,
      filename,
      onlyFullFileRewrite: true,
    });

    if (diffLines !== undefined) {
      return {
        isInstantApply: true,
        diffLinesGenerator: generateLines(diffLines!),
      };
    }
  }

  // If the code block is a diff
  if (isUnifiedDiffFormat(newLazyFile)) {
    try {
      const diffLines = applyUnifiedDiff(oldFile, newLazyFile);
      return {
        isInstantApply: true,
        diffLinesGenerator: generateLines(diffLines!),
      };
    } catch (e) {
      console.error("Failed to apply unified diff", e);
    }
  }

  return {
    isInstantApply: false,
    diffLinesGenerator: streamLazyApply(oldFile, filename, newLazyFile, llm),
  };
}
