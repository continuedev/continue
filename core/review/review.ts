import { CodeReviewOptions, IDE } from "..";
import { getChangedFiles, getDiffPerFile } from "./parseDiff";

const initialWait = 5_000;
const maxWait = 60_000;

export interface ReviewResult {
  status: "good" | "bad" | "pending";
  filepath: string;
  message: string;
}

export class CodeReview {
  constructor(
    private readonly options: CodeReviewOptions | undefined,
    private readonly ide: IDE,
  ) {
    // On startup, review all files that are currently changed
    ide.getDiff().then((diff) => {
      const filesChanged = getChangedFiles(diff);
      filesChanged.forEach((filePath) => this.runReview(filePath));
    });
  }

  private _lastWaitForFile = new Map<string, number>();
  private _timeoutForFile = new Map<string, NodeJS.Timeout>();
  private _reduceWaitIntervalForFile = new Map<string, NodeJS.Timeout>();

  fileSaved(filepath: string) {
    // Get wait time
    let wait = initialWait;
    if (this._lastWaitForFile.has(filepath)) {
      wait = this._lastWaitForFile.get(filepath)!;
    }

    // If interrupting, increase wait time
    const interrupting = this._timeoutForFile.has(filepath);
    const nextWait = interrupting ? Math.min(maxWait, wait * 1.5) : wait;

    if (interrupting) {
      clearTimeout(this._timeoutForFile.get(filepath)!);
    }

    // Create new timeout
    const newTimeout = setTimeout(() => {
      // Review the file
      this.runReview(filepath);

      // Delete this timeout
      this._timeoutForFile.delete(filepath);

      // Reduce wait time
      if (this._reduceWaitIntervalForFile.has(filepath)) {
        clearTimeout(this._reduceWaitIntervalForFile.get(filepath)!);
      }
      const reduceWaitInterval = setInterval(() => {
        const lastWait = this._lastWaitForFile.get(filepath) ?? initialWait;
        this._lastWaitForFile.set(
          filepath,
          Math.max(initialWait, lastWait / 1.5),
        );
      }, 5_000);
      this._reduceWaitIntervalForFile.set(filepath, reduceWaitInterval);
    }, nextWait);
    this._timeoutForFile.set(filepath, newTimeout);
    this._lastWaitForFile.set(filepath, nextWait);
  }

  private async runReview(filepath: string) {
    const reviewResult = await this.reviewFile(filepath);
    this._callbacks.forEach((cb) => cb(reviewResult));
  }

  private _callbacks: ((review: ReviewResult) => void)[] = [];

  public onReviewUpdate(callback: (review: ReviewResult) => void) {
    this._callbacks.push(callback);
  }

  private async reviewFile(filepath: string): Promise<ReviewResult> {
    const fullDiff = await this.ide.getDiff();
    const diffsPerFile = getDiffPerFile(fullDiff);
    const diff = diffsPerFile[filepath];
    if (diff === undefined) {
      throw new Error(`No diff for ${filepath}.`);
    }

    return this.reviewDiff(filepath, diff);
  }

  private async reviewDiff(
    filepath: string,
    diff: string,
  ): Promise<ReviewResult> {
    return Promise.resolve({
      filepath,
      message: "Looks good",
      status: "good",
    });
  }
}
