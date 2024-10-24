import { AstPath } from "./ast";
import { AutocompleteLanguageInfo } from "./languages";

const BLOCK_TYPES = ["body", "statement_block"];

function isMidlineCompletion(prefix: string, suffix: string): boolean {
  return !suffix.startsWith("\n");
}

export async function shouldCompleteMultiline(
  treePath: AstPath | undefined,
  fullPrefix: string,
  fullSuffix: string,
  language: AutocompleteLanguageInfo,
): Promise<boolean> {
  // Don't complete multi-line if you are mid-line
  if (isMidlineCompletion(fullPrefix, fullSuffix)) {
    return false;
  }

  // Don't complete multi-line for single-line comments
  if (
    fullPrefix
      .split("\n")
      .slice(-1)[0]
      ?.trimStart()
      .startsWith(language.singleLineComment)
  ) {
    return false;
  }

  return true;
}
