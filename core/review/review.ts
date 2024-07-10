import fs from "fs";
import Handlebars from "handlebars";
import path from "path";
import { CodeReviewOptions, IDE, ILLM } from "..";
import { stripImages } from "../llm/countTokens";
import { calculateHash } from "../util";
import { getReviewResultsFilepath } from "../util/paths";
import { getChangedFiles, getDiffPerFile } from "./parseDiff";
import { reviewPrompt, reviewSystemMessage } from "./prompts";
import { extractUniqueReferences } from "./parseDiff";

const initialWait = 5_000;
const maxWait = 60_000;

export interface ReviewResult {
  status: "good" | "bad" | "pending" | "error";
  filepath: string;
  message: string;
  fileHash: string;
}

export class CodeReview {
  constructor(
    private readonly options: CodeReviewOptions | undefined,
    private readonly ide: IDE,
    private readonly llm: ILLM,
  ) {
    this._refresh();
  }

  private _calculateHash(fileContents: string) {
    return calculateHash(`${this.llm.model}::${fileContents}`);
  }

  private _persistResults() {
    fs.writeFileSync(
      getReviewResultsFilepath(),
      JSON.stringify(this._currentResultsPerFile),
    );
  }

  private _lastWaitForFile = new Map<string, number>();
  private _timeoutForFile = new Map<string, NodeJS.Timeout>();
  private _reduceWaitIntervalForFile = new Map<string, NodeJS.Timeout>();

  fileSaved(filepath: string) {
    // Show file as pending
    const prevResult = this._currentResultsPerFile[filepath];
    this._emitResult({
      message: "Waiting to review...",
      filepath,
      fileHash: "",
      ...(prevResult as ReviewResult | undefined),
      status: "pending",
    });

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

  private _currentResultsPerFile: { [filepath: string]: ReviewResult } = {};
  get currentResults(): ReviewResult[] {
    return Object.values(this._currentResultsPerFile);
  }

  private _emitResult(result: ReviewResult) {
    this._callbacks.forEach((cb) => cb(result));
  }

  private async runReview(filepath: string) {
    this._emitResult({
      filepath,
      fileHash: "",
      message: "Pending",
      status: "pending",
    });
    const reviewResult = await this.reviewFile(filepath);
    this._emitResult(reviewResult);
    this._currentResultsPerFile[filepath] = reviewResult;

    // Persist the review results
    this._persistResults();
  }

  private _callbacks: ((review: ReviewResult) => void)[] = [];

  public onReviewUpdate(callback: (review: ReviewResult) => void) {
    this._callbacks.push(callback);
  }

  private async reviewFile(filepath: string): Promise<ReviewResult> {
    const fullDiff = Object.values(await this.ide.getDiff()).join("\n");
    const diffsPerFile = getDiffPerFile(fullDiff);
    const diff =
      diffsPerFile[
        Object.keys(diffsPerFile).find((f) => filepath.endsWith(f)) ?? ""
      ];
    if (diff === undefined) {
      throw new Error(`No diff for ${filepath}.`);
    }

    return this.reviewDiff(filepath, diff);
  }

  private async reviewDiff(
    filepath: string,
    diff: string,
  ): Promise<ReviewResult> {
    const contents = await this.ide.readFile(filepath);
    const fileHash = this._calculateHash(contents);

    // Extract unique references (definitions) used by the changed code
    const uniqueReferences = await extractUniqueReferences(diff, filepath);

    // Prepare the definitions content
    const definitionsContent = uniqueReferences
      .map(
        (ref) =>
          `File: ${ref.filepath}\nRange: ${ref.range.start.line}-${ref.range.end.line}\n${ref.contents}`,
      )
      .join("\n\n");

    const prompt = Handlebars.compile(reviewPrompt)({
      filepath,
      diff,
      definitions: definitionsContent,
    });

    try {
      const response = await this.llm.chat([
        { role: "system", content: reviewSystemMessage },
        { role: "user", content: prompt },
      ]);
      const completion = stripImages(response.content);

      return Promise.resolve({
        filepath,
        message: completion,
        status: "good",
        fileHash,
      });
    } catch (e) {
      return Promise.resolve({
        filepath,
        message: `Error while reviewing file: ${e}`,
        status: "error",
        fileHash,
      });
    }
  }

  private _refresh() {
    // On startup, compare saved results and current diff
    const resultsPath = getReviewResultsFilepath();
    if (fs.existsSync(resultsPath)) {
      try {
        const savedResults = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
        this._currentResultsPerFile = savedResults;
      } catch (e) {
        console.error("Failed to parse saved results", e);
      }
    }
    this.ide.getDiff().then(async (diffs) => {
      const allChangedFiles: string[] = [];
      for (const repoRoot of Object.keys(diffs)) {
        const filesChanged = getChangedFiles(diffs[repoRoot]);
        allChangedFiles.push(
          ...filesChanged.map((f) => path.join(repoRoot, f)),
        );
      }
      await Promise.all(
        allChangedFiles.map(async (filepath) => {
          // If the existing result is from the same file hash, don't repeat
          const existingResult = this._currentResultsPerFile[filepath];
          if (existingResult) {
            const fileContents = await this.ide.readFile(filepath);
            const newHash = this._calculateHash(fileContents);
            if (newHash === existingResult.fileHash) {
              return;
            }
          }
          this.runReview(filepath);
        }),
      );

      // Remove existing results if the file isn't changed anymore
      for (const filepath of Object.keys(this._currentResultsPerFile)) {
        if (!allChangedFiles.includes(filepath)) {
          delete this._currentResultsPerFile[filepath];
        }
      }
      this._persistResults();
    });
  }

  public redoAll(): void {
    console.log('redo all called in code review class');
    this._currentResultsPerFile = {};
    this._persistResults();
    this._refresh();
  }
}
