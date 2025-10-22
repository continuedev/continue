import { getRangeInString } from "../../util/ranges";
import { languageForFilepath } from "../constants/AutocompleteLanguageInfo";
import { AutocompleteInput } from "../util/types";

/**
 * We have to handle a few edge cases in getting the entire prefix/suffix for the current file.
 * This is entirely prior to finding snippets from other files
 */
export async function constructInitialPrefixSuffix(
  input: AutocompleteInput,
  lines: string[],
): Promise<{
  prefixLines: string[];
  suffixLines: string[];
}> {
  const lang = languageForFilepath(input.filepath);

  const prefixLines = getRangeInString(lines, {
    start: { line: 0, character: 0 },
    end: input.selectedCompletionInfo?.range.start ?? input.pos,
  });
  const selectedCompletionInfoText = input.selectedCompletionInfo?.text ?? "";
  const selectedCompletionInfoLines = selectedCompletionInfoText.split("\n");
  let i = 0;
  for (const line of selectedCompletionInfoLines) {
    if (i === 0) {
      prefixLines[prefixLines.length - 1] =
        prefixLines[prefixLines.length - 1] + line;
    } else {
      prefixLines.push(line);
    }
    i++;
  }

  let prefix: string;
  if (input.injectDetails) {
    const lastLine = prefixLines.pop();
    const detailsLines = input.injectDetails
      .split("\n")
      .map((line) => `${lang.singleLineComment} ${line}`);
    prefixLines.push(...detailsLines);
    if (lastLine !== undefined) {
      prefixLines.push(lastLine);
    }
  }

  const suffixLines = getRangeInString(lines, {
    start: input.pos,
    end: { line: lines.length - 1, character: Number.MAX_SAFE_INTEGER },
  });
  return { prefixLines, suffixLines };
}
