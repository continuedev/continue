import path from "path";
import { fileURLToPath } from "url";

export default {
  transform: {
    "\\.[jt]sx?$": ["ts-jest", { useESM: true }],
  },

  moduleNameMapper: {
    "^highlight\\.js/lib/languages/(.+)$":
      "<rootDir>/src/ui/__mocks__/highlightLanguage.js",
    "^lowlight$": "<rootDir>/src/ui/__mocks__/lowlight.js",
    "(.+)\\.js": "$1",
    "^ink-testing-library$":
      "<rootDir>/node_modules/ink-testing-library/build/index.js",
    "^./SyntaxHighlighter\\.js$":
      "<rootDir>/src/ui/__mocks__/SyntaxHighlighter.ts",
  },
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  preset: "ts-jest/presets/default-esm",
  testTimeout: 10000,
  testEnvironment: "node",
  testPathIgnorePatterns: ["<rootDir>/dist/"],
  transformIgnorePatterns: ["node_modules/(?!(highlight.js|lowlight)/)"],
  globals: {
    __dirname: path.dirname(fileURLToPath(import.meta.url)),
    __filename: path.resolve(fileURLToPath(import.meta.url)),
  },
};
