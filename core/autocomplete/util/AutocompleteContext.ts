import { IDE } from "../..";
import {
  countTokens,
  pruneLinesFromBottom,
  pruneLinesFromTop,
} from "../../llm/countTokens";
import { languageForFilepath } from "../../util/languageId";
import { getRangeInString } from "../../util/ranges";
import {
  AutocompleteLanguageInfo,
  getAutocompleteLanguageInfo,
} from "../constants/AutocompleteLanguageInfo";
import {
  TabAutocompleteLanguageOptions,
  TabAutocompleteOptions,
} from "../TabAutocompleteOptions";

import { AstPath, getAst, getTreePathAtCursor } from "./ast";
import { AutocompleteInput } from "./types";

export type LogWriter = (message: string) => void;
/** A subset of the context sufficient for logging. Allows easier testing */
export interface AutocompleteLoggingContext {
  options: TabAutocompleteOptions;
  langOptions: TabAutocompleteLanguageOptions;
  writeLog: LogWriter;
}

/**
 * A collection of variables that are often accessed throughout the autocomplete pipeline
 * It's noisy to re-calculate all the time or inject them into each function
 */
export class AutocompleteContext implements AutocompleteLoggingContext {
  lang: AutocompleteLanguageInfo;
  langOptions: TabAutocompleteLanguageOptions;
  treePath: AstPath | undefined;

  private _fileContents: string | undefined;
  private _fileLines: string[] | undefined;
  private _fullPrefix: string | undefined;
  private _fullSuffix: string | undefined;
  private _prunedPrefix: string | undefined;
  private _prunedSuffix: string | undefined;

  private constructor(
    public readonly input: AutocompleteInput,
    public readonly options: TabAutocompleteOptions,
    public readonly modelName: string,
    private readonly ide: IDE,
    public readonly writeLog: LogWriter,
  ) {
    this.lang = getAutocompleteLanguageInfo(
      languageForFilepath(input.filepath),
    );
    this.langOptions = {
      ...options.defaultLanguageOptions,
      ...options.languageOptions[this.lang.id],
    };
  }

  private async init() {
    // Don't do anything if already initialized
    if (this._fileContents !== undefined) {
      return;
    }

    this._fileContents =
      this.input.manuallyPassFileContents ??
      (await this.ide.readFile(this.filepath));

    this._fileLines = this._fileContents.split("\n");

    // Construct full prefix/suffix (a few edge cases handled in here)
    const { prefix: fullPrefix, suffix: fullSuffix } =
      await this.constructInitialPrefixSuffix(this.input, this.ide);
    this._fullPrefix = fullPrefix;
    this._fullSuffix = fullSuffix;

    const { prunedPrefix, prunedSuffix } = this.prunePrefixSuffix();
    this._prunedPrefix = prunedPrefix;
    this._prunedSuffix = prunedSuffix;

    try {
      const ast = await getAst(this.filepath, fullPrefix + fullSuffix);
      if (ast) {
        this.treePath = await getTreePathAtCursor(ast, fullPrefix.length);
      }
    } catch (e) {
      console.error("Failed to parse AST", e);
    }
  }

  static async create(
    input: AutocompleteInput,
    options: TabAutocompleteOptions,
    modelName: string,
    ide: IDE,
    writeLog: (message: string) => void,
  ): Promise<AutocompleteContext> {
    const instance = new AutocompleteContext(
      input,
      options,
      modelName,
      ide,
      writeLog,
    );
    await instance.init();
    return instance;
  }

  /**
   * We have to handle a few edge cases in getting the entire prefix/suffix for the current file.
   * This is entirely prior to finding snippets from other files
   */
  private async constructInitialPrefixSuffix(
    input: AutocompleteInput,
    ide: IDE,
  ): Promise<{
    prefix: string;
    suffix: string;
  }> {
    const fileContents =
      input.manuallyPassFileContents ?? (await ide.readFile(input.filepath));
    const fileLines = fileContents.split("\n");
    let prefix =
      getRangeInString(fileContents, {
        start: { line: 0, character: 0 },
        end: input.selectedCompletionInfo?.range.start ?? input.pos,
      }) + (input.selectedCompletionInfo?.text ?? "");

    if (input.injectDetails) {
      const lines = prefix.split("\n");
      prefix = `${lines.slice(0, -1).join("\n")}\n${
        this.lang.singleLineComment
      } ${input.injectDetails
        .split("\n")
        .join(
          `\n${this.lang.singleLineComment} `,
        )}\n${lines[lines.length - 1]}`;
    }

    const suffix = getRangeInString(fileContents, {
      start: input.pos,
      end: { line: fileLines.length - 1, character: Number.MAX_SAFE_INTEGER },
    });

    return { prefix, suffix };
  }

  private prunePrefixSuffix() {
    // Construct basic prefix
    const maxPrefixTokens =
      this.options.maxPromptTokens * this.options.prefixPercentage;
    const prunedPrefix = pruneLinesFromTop(
      this.fullPrefix,
      maxPrefixTokens,
      this.modelName,
    );

    // Construct suffix
    const maxSuffixTokens = Math.min(
      this.options.maxPromptTokens - countTokens(prunedPrefix, this.modelName),
      this.options.maxSuffixPercentage * this.options.maxPromptTokens,
    );
    const prunedSuffix = pruneLinesFromBottom(
      this.fullSuffix,
      maxSuffixTokens,
      this.modelName,
    );

    return {
      prunedPrefix,
      prunedSuffix,
    };
  }

  // Fast access
  get filepath() {
    return this.input.filepath;
  }
  get pos() {
    return this.input.pos;
  }

  get prunedCaretWindow() {
    return this.prunedPrefix + this.prunedSuffix;
  }

  // Getters for lazy access
  get fileContents(): string {
    if (this._fileContents === undefined) {
      throw new Error(
        "HelperVars must be initialized before accessing fileContents",
      );
    }
    return this._fileContents;
  }

  get fileLines(): string[] {
    if (this._fileLines === undefined) {
      throw new Error(
        "HelperVars must be initialized before accessing fileLines",
      );
    }
    return this._fileLines;
  }

  get fullPrefix(): string {
    if (this._fullPrefix === undefined) {
      throw new Error(
        "HelperVars must be initialized before accessing fullPrefix",
      );
    }
    return this._fullPrefix;
  }

  get fullSuffix(): string {
    if (this._fullSuffix === undefined) {
      throw new Error(
        "HelperVars must be initialized before accessing fullSuffix",
      );
    }
    return this._fullSuffix;
  }

  /** the prefix before the caret which fits into the maxPromptTokens  */
  get prunedPrefix(): string {
    if (this._prunedPrefix === undefined) {
      throw new Error(
        "HelperVars must be initialized before accessing prunedPrefix",
      );
    }
    return this._prunedPrefix;
  }

  /** the suffix after the caret which fits into the maxPromptTokens  */
  get prunedSuffix(): string {
    if (this._prunedSuffix === undefined) {
      throw new Error(
        "HelperVars must be initialized before accessing prunedSuffix",
      );
    }
    return this._prunedSuffix;
  }
}
