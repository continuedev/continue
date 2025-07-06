import { DiffLine, ILLM } from "../..";
import { generateLines } from "../../diff/util";
import { supportedLanguages } from "../../util/treeSitter";
import { getUriFileExtension } from "../../util/uri";
import { deterministicApplyLazyEdit } from "./deterministic";
import { streamLazyApply } from "./streamLazyApply";
import { applyUnifiedDiff, isUnifiedDiffFormat } from "./unifiedDiffApply";

import {
  formatDeterministicFailureMessage,
  formatUnifiedDiffFailureMessage,
} from "./debugUtils";

function canUseInstantApply(filename: string) {
  const fileExtension = getUriFileExtension(filename);
  return supportedLanguages[fileExtension] !== undefined;
}

export async function applyCodeBlock(
  oldFile: string,
  newLazyFile: string,
  filename: string,
  llm: ILLM,
  abortController: AbortController,
): Promise<{
  isInstantApply: boolean;
  diffLinesGenerator: AsyncGenerator<DiffLine>;
}> {
  if (canUseInstantApply(filename)) {
    try {
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
      } else {
        // Log when deterministic apply is bypassed
        const bypassMessage = `Deterministic lazy edit bypassed for ${filename}. Falling back to streaming approach.`;
        const fullMessage = formatDeterministicFailureMessage(
          "Deterministic approach returned undefined",
          oldFile,
          newLazyFile,
        );
        console.warn(bypassMessage);
        console.warn("Full lazy apply context:", fullMessage);
      }
    } catch (e) {
      const message = formatDeterministicFailureMessage(
        e,
        oldFile,
        newLazyFile,
      );
      console.error("Deterministic lazy edit failed:", message);
    }
  }

  // If the code block is a diff (and not undefined/null)
  if (newLazyFile && isUnifiedDiffFormat(newLazyFile)) {
    try {
      const diffLines = applyUnifiedDiff(oldFile, newLazyFile);
      return {
        isInstantApply: true,
        diffLinesGenerator: generateLines(diffLines!),
      };
    } catch (e) {
      const message = formatUnifiedDiffFailureMessage(e, oldFile, newLazyFile);
      console.error(message);
    }
  }

  return {
    isInstantApply: false,
    diffLinesGenerator: streamLazyApply(
      oldFile,
      filename,
      newLazyFile,
      llm,
      abortController,
    ),
  };
}
