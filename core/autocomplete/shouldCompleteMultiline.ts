import { AstPath } from "./ast";
import { AutocompleteLanguageInfo } from "./languages";

const BLOCK_TYPES = ["body", "statement_block"];

function shouldCompleteMultilineAst(
  treePath: AstPath,
  cursorLine: number,
): boolean {
  // If at the base of the file, do multiline
  if (treePath.length === 1) {
    return true;
  }

  // If at the first line of an otherwise empty funtion body, do multiline
  for (let i = treePath.length - 1; i >= 0; i--) {
    const node = treePath[i];
    if (
      BLOCK_TYPES.includes(node.type) &&
      Math.abs(node.startPosition.row - cursorLine) <= 1
    ) {
      let text = node.text;
      text = text.slice(text.indexOf("{") + 1);
      text = text.slice(0, text.lastIndexOf("}"));
      text = text.trim();
      return text.split("\n").length === 1;
    }
  }

  return false;
}

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

  // First, if the line before ends with an opening bracket, then assume multi-line
  if (
    ["{", "(", "["].includes(
      fullPrefix.split("\n").slice(-2)[0]?.trim().slice(-1)[0],
    )
  ) {
    return true;
  }

  // Use AST to determine whether to complete multiline
  let completeMultiline = false;
  if (treePath) {
    const cursorLine = fullPrefix.split("\n").length - 1;
    completeMultiline = shouldCompleteMultilineAst(treePath, cursorLine);
  }
  return completeMultiline;
}
