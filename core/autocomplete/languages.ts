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

export const Python = {
  stopWords: ["def", "class"],
  comment: "#",
  endOfLine: [],
};

export const Java = {
  stopWords: ["class", "function"],
  comment: "//",
  endOfLine: [";"],
};

export const LANGUAGES: { [extension: string]: AutocompleteLanguageInfo } = {
  ts: Typescript,
  js: Typescript,
  tsx: Typescript,
  jsx: Typescript,
  py: Python,
  pyi: Python,
  java: Java,
};
