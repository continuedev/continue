import { ILLM, Position, RangeInFile } from "..";
import { HelperVars } from "../autocomplete/util/HelperVars";
import { findChangedLineRanges, myersDiff } from "../diff/myers";
import { PrefetchQueue } from "../util/PrefetchQueue";
import { applyCompletionToFile } from "./diff/diff";
import { EditableRegionStrategy } from "./NextEditEditableRegionCalculator";
import { NextEditOutcome } from "./types";

export class NextEditPrefetchQueue extends PrefetchQueue<
  NextEditOutcome,
  RangeInFile,
  {
    helper: HelperVars;
    diffContext: string;
    llm: ILLM;
    token: AbortSignal;
    startTime: number;
    newCursorPos: Position;
    editableRegionStrategy: EditableRegionStrategy;
  }
> {
  async initialize(): Promise<void> {
    const firstPromise = this.fetchFunction(undefined, undefined, this.other);
    this.promiseQueue.push(firstPromise);

    const firstData = await firstPromise;
    if (this.resourceQueue.length > 0) {
      const resource = this.resourceQueue.shift()!;
      const nextPromise = this.fetchFunction(firstData, resource, this.other);
      this.promiseQueue.push(nextPromise);
    }

    if (this.other?.editableRegionStrategy === EditableRegionStrategy.Naive) {
      // Get the response from fetchFunction and compare with firstData to identify changed regions
      const resource =
        this.resourceQueue.length > 0 ? this.resourceQueue[0] : undefined;
      const secondPromise = this.fetchFunction(firstData, resource, this.other);
      const secondData = await secondPromise;
      // console.log(secondData?.completion);

      // if (secondPromise) {
      // Process this in the background
      // secondPromise
      //   .then((secondData) => {

      if (firstData && secondData) {
        // Use myersDiff to find differences between the two completions
        // const firstCompletionLines = firstData.completion.split("\n");
        // const secondCompletionLines = secondData.completion.split("\n");

        // TODO: this should be comparing old file and new file, not the completions.
        // Compare the file after first completion is merged,
        // and compare the file after first and second completion is merged.
        const appliedFirst = applyCompletionToFile(
          this.other.helper.fileContents,
          firstData.completion,
          firstData.editableRegionStartLine,
        );
        // const appliedFirstAndSecond = applyCompletionToFile(
        //   appliedFirst,
        //   secondData.completion,
        //   secondData.editableRegionStartLine,
        // );
        const diffLines = myersDiff(appliedFirst, secondData.completion);

        // Track chunks of differences
        console.log(diffLines, appliedFirst, secondData.completion);
        const changedLineRanges = findChangedLineRanges(diffLines);
        changedLineRanges.forEach((change) => {
          // Inclusive, zero-based line numbers.
          const chunk = {
            startLine: change.startLine,
            endLine: change.endLine,
          };
          console.log("chunk:", chunk);
          const chunkOutcome: NextEditOutcome = {
            ...firstData,
            uniqueId: `${firstData.uniqueId}-chunk-${chunk.startLine}-${chunk.endLine}`,
            editableRegionStartLine: chunk.startLine,
            editableRegionEndLine: chunk.endLine,
          };

          this.promiseQueue.push(Promise.resolve(chunkOutcome));
        });
      }
    }
  }

  async pop(): Promise<NextEditOutcome | undefined> {
    if (this.promiseQueue.length === 0) {
      return undefined;
    }

    if (this.other?.editableRegionStrategy === EditableRegionStrategy.Naive) {
      // The queue should already be preloaded.
      // We don't need to make extra calls to the model
      // because we assume that the items already in the queue
      // are the only items in this chain of edit.
      const currentPromise = this.promiseQueue.shift()!;

      if (this.promiseQueue.length === 0) {
        // NextEditProvider.currentEditChainId = null;
      }

      return await currentPromise;
    }

    // Get and remove the first promise from the queue
    const currentPromise = this.promiseQueue.shift()!;
    const currentData = await currentPromise;

    // If we have resources left, prefetch the next item
    if (this.resourceQueue.length > 0) {
      // Get the most recently added promise (now at the end of the queue)
      const previousPromise =
        this.promiseQueue.length > 0
          ? this.promiseQueue[this.promiseQueue.length - 1]
          : Promise.resolve(currentData);

      // Create new promise based on the previous one and next resource
      const resource = this.resourceQueue.shift()!;
      const nextPromise = previousPromise.then((data) =>
        this.fetchFunction(data, resource, this.other),
      );

      this.promiseQueue.push(nextPromise);
    } else if (this.promiseQueue.length === 0) {
      // No more items in the queue and no more resources
      // NextEditProvider.currentEditChainId = null;
    }

    // console.log("currentData:", currentData);
    return currentData;
  }
}
