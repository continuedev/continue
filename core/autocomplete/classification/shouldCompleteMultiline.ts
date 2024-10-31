import { AutocompleteLanguageInfo } from "../constants/AutocompleteLanguageInfo";
import { HelperVars } from "../HelperVars";

function isMidlineCompletion(prefix: string, suffix: string): boolean {
  return !suffix.startsWith("\n");
}

function shouldCompleteMultilineBasedOnLanguage(
  language: AutocompleteLanguageInfo,
  prefix: string,
  suffix: string,
) {
  let langMultilineDecision = language.useMultiline?.({ prefix, suffix });
  return langMultilineDecision;
}

export function decideMultilineEarly(
  helper: HelperVars,
  prefix: string,
  suffix: string,
) {
  switch (helper.options.multilineCompletions) {
    case "always":
      return true;
    case "never":
      return false;
    default:
      break;
  }

  // Don't complete multi-line if you are mid-line
  if (isMidlineCompletion(helper.fullPrefix, helper.fullSuffix)) {
    return false;
  }

  // Don't complete multi-line for single-line comments
  if (
    helper.fullPrefix
      .split("\n")
      .slice(-1)[0]
      ?.trimStart()
      .startsWith(helper.lang.singleLineComment)
  ) {
    return false;
  }

  if (shouldCompleteMultilineBasedOnLanguage(helper.lang, prefix, suffix)) {
    return true;
  }

  if (helper.input.selectedCompletionInfo) {
    return true;
  }

  return false;
}
