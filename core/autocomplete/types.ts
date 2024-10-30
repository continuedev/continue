import { Position, Range, TabAutocompleteOptions } from "..";
import { RangeInFileWithContents } from "../commands/util";
import { RecentlyEditedRange } from "./recentlyEdited";

export interface AutocompleteInput {
  completionId: string;
  filepath: string;
  pos: Position;
  recentlyEditedFiles: RangeInFileWithContents[];
  recentlyEditedRanges: RecentlyEditedRange[];
  clipboardText: string;
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

export interface AutocompleteOutcome extends TabAutocompleteOptions {
  accepted?: boolean;
  time: number;
  prefix: string;
  suffix: string;
  prompt: string;
  completion: string;
  modelProvider: string;
  modelName: string;
  completionOptions: any;
  cacheHit: boolean;
  filepath: string;
  gitRepo?: string;
  completionId: string;
  uniqueId: string;
}
