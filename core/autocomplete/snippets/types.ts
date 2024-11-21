interface BaseAutocompleteSnippet {
  score?: number;
  content: string;
}

export interface AutocompleteCodeSnippet extends BaseAutocompleteSnippet {
  filepath: string;
}

export interface AutocompleteDiffSnippet extends BaseAutocompleteSnippet {}

export interface AutocompleteClipboardSnippet extends BaseAutocompleteSnippet {}

export type AutocompleteSnippet =
  | AutocompleteCodeSnippet
  | AutocompleteDiffSnippet
  | AutocompleteClipboardSnippet;
