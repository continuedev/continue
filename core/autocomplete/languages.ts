export interface AutocompleteLanguageInfo {
  stopWords: string[];
  comment: string;
  endOfLine: string[];
}

export const Typescript = {
  stopWords: ["function", "class", "module", "export "],
  comment: "//",
  endOfLine: [";"],
};
