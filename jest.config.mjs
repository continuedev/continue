import path from "path";
import { fileURLToPath } from "url";

export default {
  transform: {
    "\\.[jt]sx?$": ["ts-jest", { useESM: true }],
  },

  moduleNameMapper: {
    "(.+)\\.js": "$1",
    "^ink-testing-library$": "<rootDir>/node_modules/ink-testing-library/build/index.js",
  },
  extensionsToTreatAsEsm: [".ts"],
  preset: "ts-jest/presets/default-esm",
  testTimeout: 10000,
  testEnvironment: "node",
  globals: {
    __dirname: path.dirname(fileURLToPath(import.meta.url)),
    __filename: path.resolve(fileURLToPath(import.meta.url)),
  },
};
