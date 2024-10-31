import { TabAutocompleteOptions } from "@continuedev/config-types";
import { AutocompleteLanguageInfo } from "../constants/AutocompleteLanguageInfo";
import { AutocompleteInput } from "../types";
import { AstPath } from "../util/ast";

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

function shouldCompleteMultilineBasedOnLanguage(
  language: AutocompleteLanguageInfo,
  prefix: string,
  suffix: string,
) {
  let langMultilineDecision = language.useMultiline?.({ prefix, suffix });
  return langMultilineDecision;
}

function shouldCompleteMultilineBasedOnSelectedCompletion(
  selectedCompletionInfo: AutocompleteInput["selectedCompletionInfo"],
  multilineCompletions: TabAutocompleteOptions["multilineCompletions"],
  completeMultiline: boolean,
) {
  return (
    !selectedCompletionInfo && // Only ever single-line if using intellisense selected value
    multilineCompletions !== "never" &&
    (multilineCompletions === "always" || completeMultiline)
  );
}

export function decideMultilineEarly({
  language,
  prefix,
  suffix,
  selectedCompletionInfo,
  multilineCompletions,
  completeMultiline,
}: {
  language: AutocompleteLanguageInfo;
  prefix: string;
  suffix: string;
  selectedCompletionInfo: AutocompleteInput["selectedCompletionInfo"];
  multilineCompletions: TabAutocompleteOptions["multilineCompletions"];
  completeMultiline: boolean;
}) {
  if (shouldCompleteMultilineBasedOnLanguage(language, prefix, suffix)) {
    return true;
  }

  if (
    shouldCompleteMultilineBasedOnSelectedCompletion(
      selectedCompletionInfo,
      multilineCompletions,
      completeMultiline,
    )
  ) {
    return true;
  }

  return false;
}
