import { streamLines } from "../../../diff/util";
import { DEFAULT_AUTOCOMPLETE_OPTS } from "../../../util/parameters";
import { HelperVars } from "../../util/HelperVars";

import { stopAtStopTokens } from "./charStream";
import {
  avoidEmptyComments,
  avoidPathLine,
  showWhateverWeHaveAtXMs,
  skipPrefixes,
  stopAtLines,
  stopAtRepeatingLines,
  stopAtSimilarLine,
  streamWithNewLines,
} from "./lineStream";

export class StreamTransformPipeline {
  async *transform(
    generator: AsyncGenerator<string>,
    prefix: string,
    suffix: string,
    multiline: boolean,
    stopTokens: string[],
    fullStop: () => void,
    helper: HelperVars,
  ): AsyncGenerator<string> {
    let charGenerator = generator;

    charGenerator = stopAtStopTokens(generator, stopTokens);
    for (const charFilter of helper.lang.charFilters ?? []) {
      charGenerator = charFilter({
        chars: charGenerator,
        prefix,
        suffix,
        filepath: helper.filepath,
        multiline,
      });
    }

    let lineGenerator = streamLines(charGenerator);

    lineGenerator = stopAtLines(lineGenerator, fullStop);
    lineGenerator = stopAtRepeatingLines(lineGenerator, fullStop);
    lineGenerator = avoidEmptyComments(
      lineGenerator,
      helper.lang.singleLineComment,
    );
    lineGenerator = avoidPathLine(lineGenerator, helper.lang.singleLineComment);
    lineGenerator = skipPrefixes(lineGenerator);

    for (const lineFilter of helper.lang.lineFilters ?? []) {
      lineGenerator = lineFilter({ lines: lineGenerator, fullStop });
    }

    lineGenerator = stopAtSimilarLine(
      lineGenerator,
      this.getLineBelowCursor(helper),
      fullStop,
    );

    lineGenerator = showWhateverWeHaveAtXMs(
      lineGenerator,
      helper.options.showWhateverWeHaveAtXMs ??
        (DEFAULT_AUTOCOMPLETE_OPTS.showWhateverWeHaveAtXMs as number),
    );

    const finalGenerator = streamWithNewLines(lineGenerator);
    for await (const update of finalGenerator) {
      yield update;
    }
  }

  private getLineBelowCursor(helper: HelperVars): string {
    let lineBelowCursor = "";
    let i = 1;
    while (
      lineBelowCursor.trim() === "" &&
      helper.pos.line + i <= helper.fileLines.length - 1
    ) {
      lineBelowCursor =
        helper.fileLines[
          Math.min(helper.pos.line + i, helper.fileLines.length - 1)
        ];
      i++;
    }
    return lineBelowCursor;
  }
}
