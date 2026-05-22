import { getRangeInString } from "../../util/ranges";
import { languageForFilepath } from "../constants/AutocompleteLanguageInfo";
import { AutocompleteInput } from "../util/types";

/**
 * We have to handle a few edge cases in getting the entire prefix/suffix for the current file.
 * This is entirely prior to finding snippets from other files.
 *
 * Accepts pre-loaded file contents to avoid a redundant file read
 * (the caller already has the contents loaded).
 */
export function constructInitialPrefixSuffix(
  input: AutocompleteInput,
  fileContents: string,
): {
  prefix: string;
  suffix: string;
} {
  const lang = languageForFilepath(input.filepath);

  const fileLines = fileContents.split("\n");
  let prefix =
    getRangeInString(fileContents, {
      start: { line: 0, character: 0 },
      end: input.selectedCompletionInfo?.range.start ?? input.pos,
    }) + (input.selectedCompletionInfo?.text ?? "");

  if (input.injectDetails) {
    const lines = prefix.split("\n");
    prefix = `${lines.slice(0, -1).join("\n")}\n${
      lang.singleLineComment
    } ${input.injectDetails
      .split("\n")
      .join(`\n${lang.singleLineComment} `)}\n${lines[lines.length - 1]}`;
  }

  const suffix = getRangeInString(fileContents, {
    start: input.pos,
    end: { line: fileLines.length - 1, character: Number.MAX_SAFE_INTEGER },
  });

  return { prefix, suffix };
}
