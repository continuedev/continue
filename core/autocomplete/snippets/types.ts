export enum AutocompleteSnippetType {
  Code = "code",
  Diff = "diff",
  Clipboard = "clipboard",
  Static = "static",
}

interface BaseAutocompleteSnippet {
  content: string;
  type: AutocompleteSnippetType;
}

export interface AutocompleteCodeSnippet extends BaseAutocompleteSnippet {
  filepath: string;
  type: AutocompleteSnippetType.Code;
}

export interface AutocompleteDiffSnippet extends BaseAutocompleteSnippet {
  type: AutocompleteSnippetType.Diff;
}

export interface AutocompleteClipboardSnippet extends BaseAutocompleteSnippet {
  type: AutocompleteSnippetType.Clipboard;
  copiedAt: string;
}

export interface AutocompleteStaticSnippet extends BaseAutocompleteSnippet {
  type: AutocompleteSnippetType.Static;
  filepath: string;
}

export type AutocompleteSnippet =
  | AutocompleteCodeSnippet
  | AutocompleteDiffSnippet
  | AutocompleteClipboardSnippet
  | AutocompleteStaticSnippet;
