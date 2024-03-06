export interface AutocompleteLanguageInfo {
  stopWords: string[];
  comment: string;
  endOfLine: string[];
}

// TypeScript
export const Typescript = {
  stopWords: ["function", "class", "module", "export"],
  comment: "//",
  endOfLine: [";"],
};

// Python
export const Python = {
  stopWords: ["def", "class"],
  comment: "#",
  endOfLine: [],
};

// Java
export const Java = {
  stopWords: ["class", "function"],
  comment: "//",
  endOfLine: [";"],
};

// C++
export const Cpp = {
  stopWords: ["class", "namespace", "template"],
  comment: "//",
  endOfLine: [";"],
};

// C#
export const CSharp = {
  stopWords: ["class", "namespace", "void"],
  comment: "//",
  endOfLine: [";"],
};

// C
export const C = {
  stopWords: ["if", "else", "while", "for", "switch", "case"],
  comment: "//",
  endOfLine: [";"],
};

// Scala
export const Scala = {
  stopWords: ["def", "val", "var", "class", "object", "trait"],
  comment: "//",
  endOfLine: [";"],
};

// Go
export const Go = {
  stopWords: ["func", "package", "import", "type"],
  comment: "//",
  endOfLine: [],
};

// Rust
export const Rust = {
  stopWords: ["fn", "mod", "pub", "struct", "enum", "trait"],
  comment: "//",
  endOfLine: [";"],
};

// Haskell
export const Haskell = {
  stopWords: [
    "data",
    "type",
    "newtype",
    "class",
    "instance",
    "let",
    "in",
    "where",
  ],
  comment: "--",
  endOfLine: [],
};

// PHP
export const PHP = {
  stopWords: ["function", "class", "namespace", "use"],
  comment: "//",
  endOfLine: [";"],
};

// Ruby on Rails
export const RubyOnRails = {
  stopWords: ["def", "class", "module"],
  comment: "#",
  endOfLine: [],
};

// Swift
export const Swift = {
  stopWords: ["func", "class", "struct", "import"],
  comment: "//",
  endOfLine: [";"],
};

// Kotlin
export const Kotlin = {
  stopWords: ["fun", "class", "package", "import"],
  comment: "//",
  endOfLine: [";"],
};

// Ruby
export const Ruby = {
  stopWords: ["class", "module", "def"],
  comment: "#",
  endOfLine: [],
};

// Clojure
export const Clojure = {
  stopWords: ["def", "fn", "let", "do", "if", "defn", "ns", "defmacro"],
  comment: ";",
  endOfLine: [],
};

// Julia
export const Julia = {
  stopWords: [
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
  comment: "#",
  endOfLine: [";"],
};

// F#
export const FSharp = {
  stopWords: [
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
  comment: "//",
  endOfLine: [],
};

// R
export const R = {
  stopWords: [
    "function",
    "if",
    "else",
    "for",
    "while",
    "repeat",
    "library",
    "require",
  ],
  comment: "#",
  endOfLine: [],
};

// Dart
export const Dart = {
  stopWords: ["class", "import", "void", "enum"],
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
};
