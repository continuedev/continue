import {
  DiffLine,
  Position,
  Range,
  RangeInFile,
  TabAutocompleteOptions,
} from "../";
import { SnippetPayload } from "../autocomplete/snippets";
import { AutocompleteCodeSnippet } from "../autocomplete/snippets/types";
import { HelperVars } from "../autocomplete/util/HelperVars";

export type RecentlyEditedRange = RangeInFile & {
  timestamp: number;
  lines: string[];
  symbols: Set<string>;
};

export interface AutocompleteInput {
  isUntitledFile: boolean;
  completionId: string;
  filepath: string;
  pos: Position;
  recentlyVisitedRanges: AutocompleteCodeSnippet[];
  recentlyEditedRanges: RecentlyEditedRange[];
  // Used for notebook files
  manuallyPassFileContents?: string;
  // Used for VS Code git commit input box
  manuallyPassPrefix?: string;
  selectedCompletionInfo?: {
    text: string;
    range: Range;
  };
  injectDetails?: string;
}

export interface NextEditOutcome extends TabAutocompleteOptions {
  // Originally from Autocomplete.
  // accepted?: boolean;
  elapsed: number;
  // prefix: string;
  // suffix: string;
  // prompt: string;
  // completion: string;
  modelProvider: string;
  modelName: string;
  completionOptions: any;
  // cacheHit: boolean;
  // numLines: number;
  // filepath: string;
  completionId: string;
  gitRepo?: string;
  uniqueId: string;
  requestId?: string;
  timestamp: number;

  // New for Next Edit.
  fileUri: string;
  workspaceDirUri: string;
  prompt: string;
  userEdits: string;
  userExcerpts: string;
  originalEditableRange: string;
  completion: string;
  cursorPosition: { line: number; character: number };
  finalCursorPosition: { line: number; character: number };
  accepted?: boolean;
  aborted?: boolean;
  editableRegionStartLine: number;
  editableRegionEndLine: number;
  diffLines: DiffLine[];
  profileType?: "local" | "platform" | "control-plane";
}

export interface PromptMetadata {
  prompt: UserPrompt;
  userEdits: string;
  userExcerpts: string;
}

export type Prompt = SystemPrompt | UserPrompt;

export interface SystemPrompt {
  role: "system";
  content: string;
}

export interface UserPrompt {
  role: "user";
  content: string;
}

export interface NextEditTemplate {
  template: string;
}

export interface TemplateVars {}

export interface InstinctTemplateVars extends TemplateVars {
  contextSnippets: string;
  currentFileContent: string;
  editDiffHistory: string; // could be a singe large unified diff
  currentFilePath: string;
  languageShorthand: string;
}

export interface MercuryTemplateVars extends TemplateVars {
  recentlyViewedCodeSnippets: string;
  currentFileContent: string;
  editDiffHistory: string; // could be a singe large unified diff
  currentFilePath: string;
}

/**
 * Context object containing all necessary information for model-specific operations.
 */
export interface ModelSpecificContext {
  helper: HelperVars;
  snippetPayload: SnippetPayload;
  editableRegionStartLine: number;
  editableRegionEndLine: number;
  diffContext: string[];
  autocompleteContext: string;
  historyDiff?: string;
  workspaceDirs?: string[];
}

/**
 * Configuration for editable region calculation.
 */
export interface EditableRegionConfig {
  usingFullFileDiff?: boolean;
  maxTokens?: number;
  topMargin?: number;
  bottomMargin?: number;
}

/**
 * Configuration for prompt generation.
 */
export interface PromptConfig {
  includeHistory?: boolean;
  includeRecentEdits?: boolean;
  maxContextSnippets?: number;
}
