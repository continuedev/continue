import type { LineFilter } from "./lineStream";

export interface AutocompleteLanguageInfo {
  topLevelKeywords: string[];
  singleLineComment: string;
  endOfLine: string[];
  stopWords?: string[];
  lineFilters?: LineFilter[];
  useMultiline?: (args: {
    prefix: string;
    suffix: string;
  }) => boolean | undefined;
}

// TypeScript
export const Typescript = {
  topLevelKeywords: ["function", "class", "module", "export", "import"],
  singleLineComment: "//",
  endOfLine: [";"],
};

// Python
export const Python = {
  // """"#" is for .ipynb files, where we add '"""' surrounding markdown blocks.
  // This stops the model from trying to complete the start of a new markdown block
  topLevelKeywords: ["def", "class", '"""#'],
  singleLineComment: "#",
  endOfLine: [],
};

// Java
export const Java = {
  topLevelKeywords: ["class", "function"],
  singleLineComment: "//",
  endOfLine: [";"],
};

// C++
export const Cpp = {
  topLevelKeywords: ["class", "namespace", "template"],
  singleLineComment: "//",
  endOfLine: [";"],
};

// C#
export const CSharp = {
  topLevelKeywords: ["class", "namespace", "void"],
  singleLineComment: "//",
  endOfLine: [";"],
};

// C
export const C = {
  topLevelKeywords: ["if", "else", "while", "for", "switch", "case"],
  singleLineComment: "//",
  endOfLine: [";"],
};

// Scala
export const Scala = {
  topLevelKeywords: ["def", "val", "var", "class", "object", "trait"],
  singleLineComment: "//",
  endOfLine: [";"],
};

// Go
export const Go = {
  topLevelKeywords: ["func", "package", "import", "type"],
  singleLineComment: "//",
  endOfLine: [],
};

// Rust
export const Rust = {
  topLevelKeywords: ["fn", "mod", "pub", "struct", "enum", "trait"],
  singleLineComment: "//",
  endOfLine: [";"],
};

// Haskell
export const Haskell = {
  topLevelKeywords: [
    "data",
    "type",
    "newtype",
    "class",
    "instance",
    "let",
    "in",
    "where",
  ],
  singleLineComment: "--",
  endOfLine: [],
};

// PHP
export const PHP = {
  topLevelKeywords: ["function", "class", "namespace", "use"],
  singleLineComment: "//",
  endOfLine: [";"],
};

// Ruby on Rails
export const RubyOnRails = {
  topLevelKeywords: ["def", "class", "module"],
  singleLineComment: "#",
  endOfLine: [],
};

// Swift
export const Swift = {
  topLevelKeywords: ["func", "class", "struct", "import"],
  singleLineComment: "//",
  endOfLine: [";"],
};

// Kotlin
export const Kotlin = {
  topLevelKeywords: ["fun", "class", "package", "import"],
  singleLineComment: "//",
  endOfLine: [";"],
};

// Ruby
export const Ruby = {
  topLevelKeywords: ["class", "module", "def"],
  singleLineComment: "#",
  endOfLine: [],
};

// Clojure
export const Clojure = {
  topLevelKeywords: ["def", "fn", "let", "do", "if", "defn", "ns", "defmacro"],
  singleLineComment: ";",
  endOfLine: [],
};

// Julia
export const Julia = {
  topLevelKeywords: [
    "function",
    "macro",
    "if",
    "else",
    "elseif",
    "while",
    "for",
    "begin",
    "end",
    "module",
  ],
  singleLineComment: "#",
  endOfLine: [";"],
};

// F#
export const FSharp = {
  topLevelKeywords: [
    "let",
    "type",
    "module",
    "namespace",
    "open",
    "if",
    "then",
    "else",
    "match",
    "with",
  ],
  singleLineComment: "//",
  endOfLine: [],
};

// R
export const R = {
  topLevelKeywords: [
    "function",
    "if",
    "else",
    "for",
    "while",
    "repeat",
    "library",
    "require",
  ],
  singleLineComment: "#",
  endOfLine: [],
};

// Dart
export const Dart = {
  topLevelKeywords: ["class", "import", "void", "enum"],
  singleLineComment: "//",
  endOfLine: [";"],
};

// Solidity
export const Solidity = {
  topLevelKeywords: [
    "contract",
    "event",
    "modifier",
    "function",
    "constructor",
    "for",
    "require",
    "emit",
    "interface",
    "error",
    "library",
    "struct",
    "enum",
    "type",
  ],
  singleLineComment: "//",
  endOfLine: [";"],
};

// YAML
export const YAML: AutocompleteLanguageInfo = {
  topLevelKeywords: [],
  singleLineComment: "#",
  endOfLine: [],
  lineFilters: [
    // Only display one list item at a time
    async function* ({ lines, fullStop }) {
      let seenListItem = false;
      for await (const line of lines) {
        if (line.trim().startsWith("- ")) {
          if (seenListItem) {
            fullStop();
            break;
          } else {
            seenListItem = true;
          }
          yield line;
        } else {
          yield line;
        }
      }
    },
    // Don't allow consecutive lines of same key
    async function* ({ lines }) {
      let lastKey = undefined;
      for await (const line of lines) {
        if (line.includes(":")) {
          const key = line.split(":")[0];
          if (key !== lastKey) {
            yield line;
            lastKey = key;
          } else {
            break;
          }
        }
      }
    },
  ],
};

export const Markdown: AutocompleteLanguageInfo = {
  topLevelKeywords: [],
  singleLineComment: "",
  endOfLine: [],
  useMultiline: ({ prefix, suffix }) => {
    const singleLineStarters = ["- ", "* ", /^\d+\. /, "> ", "```", /^#{1,6} /];
    let currentLine = prefix.split("\n").pop();
    if (!currentLine) {
      return undefined;
    }
    currentLine = currentLine.trim();
    for (const starter of singleLineStarters) {
      if (
        typeof starter === "string"
          ? currentLine.startsWith(starter)
          : starter.test(currentLine)
      ) {
        return false;
      }
    }
    return undefined;
  },
};

export const LANGUAGES: { [extension: string]: AutocompleteLanguageInfo } = {
  ts: Typescript,
  js: Typescript,
  tsx: Typescript,
  jsx: Typescript,
  ipynb: Python,
  py: Python,
  pyi: Python,
  java: Java,
  cpp: Cpp,
  cxx: Cpp,
  h: Cpp,
  hpp: Cpp,
  cs: CSharp,
  c: C,
  scala: Scala,
  sc: Scala,
  go: Go,
  rs: Rust,
  hs: Haskell,
  php: PHP,
  rb: Ruby,
  rails: RubyOnRails,
  swift: Swift,
  kt: Kotlin,
  clj: Clojure,
  cljs: Clojure,
  cljc: Clojure,
  jl: Julia,
  fs: FSharp,
  fsi: FSharp,
  fsx: FSharp,
  fsscript: FSharp,
  r: R,
  R: R,
  dart: Dart,
  sol: Solidity,
  yaml: YAML,
  yml: YAML,
  md: Markdown,
};
