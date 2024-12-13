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

    charGenerator = stopAtStopTokens(generator, stopTokens, (token) => {
      if (ctx.options.logCompletionStop)
        ctx.writeLog(`CompletionStop: Completion stopped at token: ${token}`);
    });
    charGenerator = stopAtStartOf(charGenerator, suffix, 20, () => {
      if (ctx.options.logCompletionStop)
        ctx.writeLog(
          `CompletionStop: Completion stopped at suffix: \n---\n${suffix}\n---`,
        );
    });
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
        if (ctx.options.logDroppedLinesFilter)
          ctx.writeLog(`EmptySingleLineCommentFilter: removed line ${line}`);
      },
    );

    lineGenerator = avoidPathLine(
      lineGenerator,
      ctx.lang.singleLineComment,
      (droppedLine) => {
        if (ctx.options.logDroppedLinesFilter) {
          ctx.writeLog(`PathLineFilter:removed line ${droppedLine}`);
        }
      },
    );
    lineGenerator = skipPrefixes(lineGenerator, (prefix, line) => {
      if (ctx.options.logDroppedLinesFilter) {
        ctx.writeLog(
          `PathLineFilter: removed prefix ${prefix} from line ${line}`,
        );
      }
    });
    lineGenerator = noDoubleNewLine(lineGenerator, () => {
      if (ctx.options.logCompletionStop) {
        ctx.writeLog(`Completion Stop: stopped due to double new line`);
      }
    });

    for (const lineFilter of ctx.lang.lineFilters ?? []) {
      lineGenerator = lineFilter({
        lines: lineGenerator,
        fullStop,
        options: ctx.options,
        langOptions: ctx.langOptions,
        writeLog: ctx.writeLog,
      });
    }

    lineGenerator = stopAtSimilarLine(
      lineGenerator,
      this.getLineBelowCursor(ctx),
      (inputLine, compareLine) => {
        if (ctx.options.logCompletionStop)
          ctx.writeLog(
            `CompletionStop: Stopped at line "${inputLine}" because it is similar to ${compareLine}`,
          );
        fullStop();
      },
    );

    lineGenerator = showWhateverWeHaveAtXMs(
      lineGenerator,
      ctx.options.showWhateverWeHaveAtXMs,
      () => {
        if (ctx.options.logCompletionStop)
          ctx.writeLog(
            `CompletionStop: Stopped after ${ctx.options.showWhateverWeHaveAtXMs}ms`,
          );
      },
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
