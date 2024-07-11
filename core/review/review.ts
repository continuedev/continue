import fs from "fs";
import Handlebars from "handlebars";
import path from "path";
import { CodeReviewOptions, IDE, ILLM } from "..";
import { stripImages } from "../llm/countTokens";
import { calculateHash } from "../util";
import { getReviewResultsFilepath } from "../util/paths";
import { getChangedFiles, getDiffPerFile, padReferences } from "./parseDiff";
import { reviewPrompt, reviewSystemMessage } from "./prompts";
import { extractUniqueReferences } from "./parseDiff";
import { RangeInFileWithContents } from "../commands/util";
import {
  deduplicateSnippets,
  fillPromptWithSnippets,
} from "../autocomplete/ranking";
import { RangeInFile } from "../index";

const initialWait = 5_000;
const maxWait = 60_000;

export interface ReviewResult {
  filepath: string;
  fileHash: string;
  status: "good" | "bad" | "pending" | "error";
  reviewParts: ReviewPart[];
  summary: string;
}

export interface ReviewPart {
  comment: string;
  category: ReviewCategory;
}

export enum ReviewCategory {
  style = "🎨 Style",
  codeSmell = "🦨 Code Smell",
  complexity = "🧩 Complexity",
  deadCode = "💀 Dead Code",
  performance = "⚡ Performance",
  security = "🔒 Security",
  maintainability = "🔧 Maintainability",
  errorHandling = "🚨 Error Handling",
  duplication = "🐑 Duplication",
  naming = "🏷️ Naming",
  architecture = "🏗️ Architecture",
  optimization = "🚀 Optimization",
  readability = "📖 Readability",
  typeSafety = "🛡️ Type Safety",
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
      summary: "Waiting to review...",
      filepath,
      fileHash: "",
      ...(prevResult as ReviewResult | undefined),
      status: "pending",
      reviewParts: prevResult?.reviewParts ?? [],
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
      summary: "Pending",
      status: "pending",
      reviewParts: [],
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

  private systemPrompt(): string {
    const categories = Object.keys(ReviewCategory);
    const template = Handlebars.compile(reviewSystemMessage);
    return template({ categories });
  }

  private reviewPrompt(
    filepath: string,
    rifs: RangeInFileWithContents[],
    diff: string,
  ): string {
    const definitionsContent = rifs
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
    return prompt;
  }

  private async reviewDiff(
    filepath: string,
    diff: string,
  ): Promise<ReviewResult> {
    const contents = await this.ide.readFile(filepath);
    const fileHash = this._calculateHash(contents);

    // Extract unique references (definitions) used by the changed code
    const uniqueReferences: RangeInFile[] = await extractUniqueReferences(
      diff,
      filepath,
    );

    console.log("processing filepath: " + filepath);
    console.log("uniqueReferences", uniqueReferences);

    const paddedReferences = await padReferences(uniqueReferences);

    // Deduplicate and combine overlapping snippets
    const deduplicatedSnippets = deduplicateSnippets(
      paddedReferences.map((ref: RangeInFileWithContents) => ({
        ...ref,
        score: 1, // You may want to adjust this based on relevance
      })),
    );

    // Limit the total number of tokens for the snippets
    const maxSnippetTokens = 2000; // Adjust this value as needed
    const finalSnippets = fillPromptWithSnippets(
      deduplicatedSnippets,
      maxSnippetTokens,
      this.llm.model,
    );

    // Prepare the definitions content
    const systemPrompt = this.systemPrompt();
    const prompt = this.reviewPrompt(filepath, finalSnippets, diff);
    console.log("Final Prompt: ", prompt);

    try {
      const response = await this.llm.chat([
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ]);
      const completion = stripImages(response.content);

      const review = this._parseReviewXML(completion);

      const reviewResult: ReviewResult = {
        filepath,
        status: review.status as "good" | "bad" | "error",
        reviewParts: review.reviewParts,
        summary: review.summary,
        fileHash,
      };

      return Promise.resolve(reviewResult);
    } catch (e) {
      return Promise.resolve({
        filepath,
        summary: `Error while reviewing file: ${e}`,
        status: "error",
        fileHash,
        reviewParts: [],
      });
    }
  }

  private _parseReviewXML(xmlString: string): ReviewResult {
    // Extract XML content
    const xmlContent = xmlString.match(/<review>[\s\S]*<\/review>/);
    const xmlToParse = xmlContent
      ? xmlContent[0]
      : `<review>${xmlString}</review>`;

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlToParse, "text/xml");

    const review: ReviewResult = {
      filepath: xmlDoc.querySelector("filepath")?.textContent ?? "",
      fileHash: "",
      status:
        (xmlDoc.querySelector("status")?.textContent as
          | "good"
          | "bad"
          | "pending"
          | "error") ?? "error",
      reviewParts: Array.from(xmlDoc.querySelectorAll("reviewPart")).map(
        (part) => ({
          category:
            (part.querySelector("category")?.textContent as ReviewCategory) ??
            ReviewCategory.codeSmell,
          comment: part.querySelector("comment")?.textContent ?? "",
        }),
      ),
      summary: xmlDoc.querySelector("summary")?.textContent ?? "",
    };

    // If no valid XML was found, set status to error
    if (review.filepath === "" || review.summary === "") {
      return {
        filepath: "",
        status: "error",
        reviewParts: [],
        summary: "Error: Invalid review format received from LLM.",
        fileHash: "",
      };
    }

    return review;
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
    console.log("redo all called in code review class");
    this._currentResultsPerFile = {};
    this._persistResults();
    this._refresh();
  }
}
