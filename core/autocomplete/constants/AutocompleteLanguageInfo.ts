import { languageForFilepath, LanguageId } from "../../util/languageId";
import { BracketMatchingService } from "../filtering/BracketMatchingService";
import {
  CharacterFilter,
  LineFilter,
} from "../filtering/streamTransforms/lineStream";

export interface AutocompleteLanguageInfo {
  id: LanguageId;
  name: string;
  topLevelKeywords: string[];
  singleLineComment?: string;
  endOfLine: string[];
  lineFilters?: LineFilter[];
  charFilters?: CharacterFilter[];
  useMultiline?: (args: { prefix: string; suffix: string }) => boolean;
}

const languageInfos: AutocompleteLanguageInfo[] = [
  // TypeScript
  {
    id: LanguageId.Typescript,
    name: "TypeScript",
    topLevelKeywords: ["function", "class", "module", "export", "import"],
    singleLineComment: "//",
    endOfLine: [";"],
  },

  // Python
  {
    id: LanguageId.Python,
    name: "Python",
    // """"#" is for .ipynb files, where we add '"""' surrounding markdown blocks.
    // This stops the model from trying to complete the start of a new markdown block
    topLevelKeywords: ["def", "class", '"""#'],
    singleLineComment: "#",
    endOfLine: [],
  },

  // Java
  {
    id: LanguageId.Java,
    name: "Java",
    topLevelKeywords: ["class", "function"],
    singleLineComment: "//",
    endOfLine: [";"],
  },

  // C++
  {
    id: LanguageId.Cpp,
    name: "C++",
    topLevelKeywords: ["class", "namespace", "template"],
    singleLineComment: "//",
    endOfLine: [";"],
  },

  // C#
  {
    id: LanguageId.CSharp,
    name: "C#",
    topLevelKeywords: ["class", "namespace", "void"],
    singleLineComment: "//",
    endOfLine: [";"],
  },

  // C
  {
    id: LanguageId.C,
    name: "C",
    topLevelKeywords: ["if", "else", "while", "for", "switch", "case"],
    singleLineComment: "//",
    endOfLine: [";"],
  },

  // Scala
  {
    id: LanguageId.Scala,
    name: "Scala",
    topLevelKeywords: ["def", "val", "var", "class", "object", "trait"],
    singleLineComment: "//",
    endOfLine: [";"],
  },

  // Go
  {
    id: LanguageId.Go,
    name: "Go",
    topLevelKeywords: ["func", "package", "import", "type"],
    singleLineComment: "//",
    endOfLine: [],
  },

  // Rust
  {
    id: LanguageId.Rust,
    name: "Rust",
    topLevelKeywords: ["fn", "mod", "pub", "struct", "enum", "trait"],
    singleLineComment: "//",
    endOfLine: [";"],
  },

  // Haskell
  {
    id: LanguageId.Haskell,
    name: "Haskell",
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
  },

  // PHP
  {
    id: LanguageId.PHP,
    name: "PHP",
    topLevelKeywords: ["function", "class", "namespace", "use"],
    singleLineComment: "//",
    endOfLine: [";"],
  },

  // Ruby on Rails
  {
    id: LanguageId.RubyOnRails,
    name: "Ruby on Rails",
    topLevelKeywords: ["def", "class", "module"],
    singleLineComment: "#",
    endOfLine: [],
  },

  // Swift
  {
    id: LanguageId.Swift,
    name: "Swift",
    topLevelKeywords: ["func", "class", "struct", "import"],
    singleLineComment: "//",
    endOfLine: [";"],
  },

  // Kotlin
  {
    id: LanguageId.Kotlin,
    name: "Kotlin",
    topLevelKeywords: ["fun", "class", "package", "import"],
    singleLineComment: "//",
    endOfLine: [";"],
  },

  // Ruby
  {
    id: LanguageId.Ruby,
    name: "Ruby",
    topLevelKeywords: ["class", "module", "def"],
    singleLineComment: "#",
    endOfLine: [],
  },

  // Clojure
  {
    id: LanguageId.Clojure,
    name: "Clojure",
    topLevelKeywords: [
      "def",
      "fn",
      "let",
      "do",
      "if",
      "defn",
      "ns",
      "defmacro",
    ],
    singleLineComment: ";",
    endOfLine: [],
  },

  // Julia
  {
    id: LanguageId.Julia,
    name: "Julia",
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
  },

  // F#
  {
    id: LanguageId.FSharp,
    name: "F#",
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
  },

  // R
  {
    id: LanguageId.R,
    name: "R",
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
  },

  // Dart
  {
    id: LanguageId.Dart,
    name: "Dart",
    topLevelKeywords: ["class", "import", "void", "enum"],
    singleLineComment: "//",
    endOfLine: [";"],
  },

  // Solidity
  {
    id: LanguageId.Solidity,
    name: "Solidity",
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
  },

  // YAML
  {
    id: LanguageId.YAML,
    name: "YAML",
    topLevelKeywords: [],
    singleLineComment: "#",
    endOfLine: [],
    lineFilters: [
      // Only display one list item at a time
      async function* ({ lines, fullStop, options, writeLog }) {
        let seenListItem = false;
        for await (const line of lines) {
          if (line.trim().startsWith("- ")) {
            if (seenListItem) {
              if (options.logCompletionStop)
                writeLog(
                  `CompletionStop: YAML: stopped on the second list item`,
                );
              fullStop();
              break;
            } else {
              seenListItem = true;
            }
          }
          yield line;
        }
      },
      // Don't allow consecutive lines of same key
      async function* ({ lines, options, writeLog }) {
        let lastKey = undefined;
        for await (const line of lines) {
          if (line.includes(":")) {
            const key = line.split(":")[0];
            if (key === lastKey) {
              if (options.logCompletionStop)
                writeLog(
                  `CompletionStop: YAML: stopped on repeated object key`,
                );
              break;
            } else {
              yield line;
              lastKey = key;
            }
          } else {
            yield line;
          }
        }
      },
    ],
  },

  {
    id: LanguageId.Json,
    name: "JSON",
    topLevelKeywords: [],
    singleLineComment: "//",
    endOfLine: [",", "}", "]"],
    charFilters: [
      function matchBrackets({
        chars,
        prefix,
        suffix,
        filepath,
        multiline,
        options,
        writeLog,
      }) {
        const bracketMatchingService = new BracketMatchingService();
        return bracketMatchingService.stopOnUnmatchedClosingBracket(
          chars,
          prefix,
          suffix,
          filepath,
          multiline,
          options.logCompletionStop
            ? async (msg) =>
                writeLog("CompletionStop: JSON bracket matching: " + msg)
            : undefined,
        );
      },
    ],
  },

  {
    id: LanguageId.Markdown,
    name: "Markdown",
    topLevelKeywords: [],
    singleLineComment: "",
    endOfLine: [],
    useMultiline: ({ prefix, suffix }) => {
      const singleLineStarters = [
        "- ",
        "* ",
        /^\d+\. /,
        "> ",
        "```",
        /^#{1,6} /,
      ];
      let currentLine = prefix.split("\n").pop();
      if (!currentLine) {
        return true;
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
      return true;
    },
  },
];

const LANGUAGES: { [id in LanguageId]?: AutocompleteLanguageInfo } =
  Object.fromEntries(languageInfos.map((language) => [language.id, language]));

export function getAutocompleteLanguageInfo(
  languageId: LanguageId,
): AutocompleteLanguageInfo {
  return LANGUAGES[languageId] || LANGUAGES[LanguageId.Typescript]!;
}
export function getAutocompleteLanguageInfoForFile(
  filepath: string,
): AutocompleteLanguageInfo {
  return getAutocompleteLanguageInfo(languageForFilepath(filepath));
}
