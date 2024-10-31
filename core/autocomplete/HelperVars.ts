import { IDE, TabAutocompleteOptions } from "..";
import { AutocompleteLanguageInfo } from "./constants/AutocompleteLanguageInfo";
import { languageForFilepath } from "./constructPrompt";
import { AutocompleteInput } from "./types";

/**
 * A collection of variables that are often accessed throughout the autocomplete pipeline
 * It's noisy to re-calculate all the time or inject them into each function
 */
export class HelperVars {
  lang: AutocompleteLanguageInfo;
  private _fileContents: string | undefined;
  private _fileLines: string[] | undefined;

  constructor(
    public readonly input: AutocompleteInput,
    public readonly options: TabAutocompleteOptions,
    public readonly modelName: string,
    private readonly ide: IDE,
  ) {
    this.lang = languageForFilepath(input.filepath);
  }

  async init() {
    // Don't do anything if already initialized
    if (this._fileContents !== undefined) return;

    this._fileContents =
      this.input.manuallyPassFileContents ??
      (await this.ide.readFile(this.filepath));

    this._fileLines = this._fileContents.split("\n");
  }

  // Fast access
  get filepath() {
    return this.input.filepath;
  }
  get pos() {
    return this.input.pos;
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
}
