import { streamLines } from "../../../diff/util";
import { AutocompleteContext } from "../../util/AutocompleteContext";

import { stopAtStartOf, stopAtStopTokens } from "./charStream";
import {
  avoidEmptyComments,
  avoidPathLine,
  noDoubleNewLine,
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
    ctx: AutocompleteContext,
  ): AsyncGenerator<string> {
    let charGenerator = generator;

    charGenerator = stopAtStopTokens(generator, stopTokens);
    charGenerator = stopAtStartOf(charGenerator, suffix);
    for (const charFilter of ctx.lang.charFilters ?? []) {
      charGenerator = charFilter({
        chars: charGenerator,
        prefix,
        suffix,
        filepath: ctx.filepath,
        multiline,
        options: ctx.options,
        langOptions: ctx.langOptions,
        writeLog: ctx.writeLog,
      });
    }

    let lineGenerator = streamLines(charGenerator);

    lineGenerator = stopAtLines(lineGenerator, (line, pattern) => {
      if (ctx.options.logCompletionStop)
        ctx.writeLog(
          `CompletionStop: Completion stopped at line: due to pattern ${pattern} at line\n${line}`,
        );
      fullStop();
    });
    lineGenerator = stopAtRepeatingLines(
      lineGenerator,
      () => {
        if (ctx.options.logCompletionStop)
          ctx.writeLog(
            `CompletionStop: Completion stopped after encountering ${ctx.langOptions.filterMaxRepeatingLines} repeated lines`,
          );
        fullStop();
      },
      ctx.langOptions.filterMaxRepeatingLines,
    );

    lineGenerator = avoidEmptyComments(
      lineGenerator,
      ctx.lang.singleLineComment,
      (line) => {
        if (ctx.options.logEmptySingleLineCommentFilter)
          ctx.writeLog(`EmptySingleLineCommentFilter:removed line ${line}`);
      },
    );

    lineGenerator = avoidPathLine(lineGenerator, ctx.lang.singleLineComment);
    lineGenerator = skipPrefixes(lineGenerator);
    lineGenerator = noDoubleNewLine(lineGenerator);

    for (const lineFilter of ctx.lang.lineFilters ?? []) {
      lineGenerator = lineFilter({ lines: lineGenerator, fullStop });
    }

    lineGenerator = stopAtSimilarLine(
      lineGenerator,
      this.getLineBelowCursor(ctx),
      fullStop,
    );

    lineGenerator = showWhateverWeHaveAtXMs(
      lineGenerator,
      ctx.options.showWhateverWeHaveAtXMs,
    );

    const finalGenerator = streamWithNewLines(lineGenerator);
    for await (const update of finalGenerator) {
      yield update;
    }
  }

  private getLineBelowCursor(helper: AutocompleteContext): string {
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
