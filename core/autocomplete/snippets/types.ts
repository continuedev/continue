export enum AutocompleteSnippetType {
  Code = "code",
  Diff = "diff",
  Clipboard = "clipboard",
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

type Filepath = string;
type RelevantType = string;
type RelevantHeader = string;

export interface AutocompleteStaticSnippet extends BaseAutocompleteSnippet {
  type: AutocompleteSnippetType.Code;
  holeType: string,
  relevantTypes: Map<Filepath, RelevantType[]>,
  relevantHeaders: Map<Filepath, RelevantHeader[]>
}

export type AutocompleteSnippet =
  | AutocompleteCodeSnippet
  | AutocompleteDiffSnippet
  | AutocompleteClipboardSnippet
  | AutocompleteStaticSnippet;
