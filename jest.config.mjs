import path from "path";
import { fileURLToPath } from "url";

export default {
  transform: {
    "\\.[jt]sx?$": ["ts-jest", { useESM: true }],
  },

  moduleNameMapper: {
    "^(\\.{1,2}/.+)\\.js$": "$1",
    "^highlight\\.js/lib/languages/(.+)$":
      "<rootDir>/src/ui/__mocks__/highlightLanguage.js",
    "^lowlight$": "<rootDir>/src/ui/__mocks__/lowlight.js",
    "^ink-testing-library$":
      "<rootDir>/node_modules/ink-testing-library/build/index.js",
    "^./SyntaxHighlighter\\.js$":
      "<rootDir>/src/ui/__mocks__/SyntaxHighlighter.ts",
    "^./FreeTrialStatus\\.js$":
      "<rootDir>/src/ui/__mocks__/FreeTrialStatus.tsx",
  },
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  preset: "ts-jest/presets/default-esm",
  testTimeout: 10000,
  testEnvironment: "node",
  testPathIgnorePatterns: ["<rootDir>/dist/"],
  modulePathIgnorePatterns: ["<rootDir>/dist/"],
  transformIgnorePatterns: ["node_modules/(?!(highlight.js|lowlight)/)"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  globals: {
    __dirname: path.dirname(fileURLToPath(import.meta.url)),
    __filename: path.resolve(fileURLToPath(import.meta.url)),
  },
  resolver: "<rootDir>/jest.resolver.cjs",
  // Force E2E tests to run sequentially to avoid console override conflicts
  projects: [
    {
      displayName: "e2e",
      testMatch: ["<rootDir>/src/e2e/**/*.test.ts"],
      maxWorkers: 1,
      transform: {
        "\\.[jt]sx?$": ["ts-jest", { useESM: true }],
      },
      moduleNameMapper: {
        "^(\\.{1,2}/.+)\\.js$": "$1",
      },
      extensionsToTreatAsEsm: [".ts", ".tsx"],
      preset: "ts-jest/presets/default-esm",
      testEnvironment: "node",
      setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
      resolver: "<rootDir>/jest.resolver.cjs",
    },
    {
      displayName: "unit",
      testMatch: ["<rootDir>/src/**/*.test.ts", "<rootDir>/src/**/*.test.tsx"],
      testPathIgnorePatterns: ["<rootDir>/src/e2e/"],
      transform: {
        "\\.[jt]sx?$": ["ts-jest", { useESM: true }],
      },
      moduleNameMapper: {
        "^(\\.{1,2}/.+)\\.js$": "$1",
        "^highlight\\.js/lib/languages/(.+)$":
          "<rootDir>/src/ui/__mocks__/highlightLanguage.js",
        "^lowlight$": "<rootDir>/src/ui/__mocks__/lowlight.js",
        "^ink-testing-library$":
          "<rootDir>/node_modules/ink-testing-library/build/index.js",
        "^./SyntaxHighlighter\\.js$":
          "<rootDir>/src/ui/__mocks__/SyntaxHighlighter.ts",
        "^./FreeTrialStatus\\.js$":
          "<rootDir>/src/ui/__mocks__/FreeTrialStatus.tsx",
      },
      extensionsToTreatAsEsm: [".ts", ".tsx"],
      preset: "ts-jest/presets/default-esm",
      testEnvironment: "node",
      setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
      resolver: "<rootDir>/jest.resolver.cjs",
    },
  ],
};
