import { Position } from "../../..";
import { streamLines } from "../../../diff/util";
import { AutocompleteLanguageInfo } from "../../constants/AutocompleteLanguageInfo";
import { BracketMatchingService } from "../BracketMatchingService";
import { stopAtStopTokens } from "./charStream";
import {
  avoidPathLineAndEmptyComments,
  skipPrefixes,
  stopAtLines,
  stopAtRepeatingLines,
  stopAtSimilarLine,
  streamWithNewLines,
} from "./lineStream";

export class StreamTransformPipeline {
  private bracketMatchingService = new BracketMatchingService();

  async *transform(
    generator: AsyncGenerator<string>,
    prefix: string,
    suffix: string,
    filepath: string,
    multiline: boolean,
    pos: Position,
    fileLines: string[],
    stopTokens: string[],
    lang: AutocompleteLanguageInfo,
    fullStop: () => void,
  ): AsyncGenerator<string> {
    let charGenerator = generator;

    // charGenerator = noFirstCharNewline(charGenerator);
    // charGenerator = onlyWhitespaceAfterEndOfLine(
    //   charGenerator,
    //   lang.endOfLine,
    //   fullStop,
    // );
    charGenerator = stopAtStopTokens(generator, stopTokens);
    charGenerator = this.bracketMatchingService.stopOnUnmatchedClosingBracket(
      charGenerator,
      prefix,
      suffix,
      filepath,
      multiline,
    );

    let lineGenerator = streamLines(charGenerator);

    // First non-whitespace line below the cursor
    let lineBelowCursor = "";
    let i = 1;
    while (
      lineBelowCursor.trim() === "" &&
      pos.line + i <= fileLines.length - 1
    ) {
      lineBelowCursor = fileLines[Math.min(pos.line + i, fileLines.length - 1)];
      i++;
    }

    lineGenerator = stopAtLines(lineGenerator, fullStop);
    lineGenerator = stopAtRepeatingLines(lineGenerator, fullStop);
    lineGenerator = avoidPathLineAndEmptyComments(
      lineGenerator,
      lang.singleLineComment,
    );
    lineGenerator = skipPrefixes(lineGenerator);

    // lineGenerator = noTopLevelKeywordsMidline(
    //   lineGenerator,
    //   lang.topLevelKeywords,
    //   fullStop,
    // );
    for (const lineFilter of lang.lineFilters ?? []) {
      lineGenerator = lineFilter({ lines: lineGenerator, fullStop });
    }

    lineGenerator = stopAtSimilarLine(lineGenerator, lineBelowCursor, fullStop);

    const finalGenerator = streamWithNewLines(lineGenerator);
    for await (const update of finalGenerator) {
      yield update;
    }
  }
}
