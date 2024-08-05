import path from "path";
import { fileURLToPath } from "url";

export default {
  transform: {
    "^.+\\.(ts|js)$": ["ts-jest", { useESM: true, useIsolatedModules: true }],
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^uuid$": "uuid", // https://stackoverflow.com/a/73626360
  },
  extensionsToTreatAsEsm: [".ts"],
  preset: "ts-jest/presets/default-esm",
  testTimeout: 10000,
  testEnvironment: "node",
  globals: {
    __dirname: path.dirname(fileURLToPath(import.meta.url)),
    __filename: path.resolve(fileURLToPath(import.meta.url)),
  },
  globalSetup: "<rootDir>/jest.global-setup.ts",
  setupFilesAfterEnv: ["<rootDir>/jest.setup-after-env.ts"],
};
