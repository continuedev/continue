import path from "path";
import { fileURLToPath } from "url";

export default {
  transform: {
    "^.+\\.(ts|js)$": [
      "ts-jest",
      {
        useESM: true,
        isolatedModules: true,
        tsconfig: {
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^uuid$": "uuid", // https://stackoverflow.com/a/73626360
    "^@azure/(.*)$": "<rootDir>/node_modules/@azure/$1",
    "^mssql$": "<rootDir>/node_modules/mssql",
  },
  extensionsToTreatAsEsm: [".ts"],
  preset: "ts-jest/presets/default-esm",
  testTimeout: 10000,
  testEnvironment: "node",
  globals: {
    __dirname: path.dirname(fileURLToPath(import.meta.url)),
    __filename: path.resolve(fileURLToPath(import.meta.url)),
  },
  // collectCoverage: true,
  collectCoverageFrom: [
    "**/*.{js,ts}", // Adjust this pattern to match files you want coverage for
    "!**/node_modules/**", // Exclude node_modules
    "!**/vendor/**",
    // "!**/autocomplete/context/root-path-context/test/files/**",
  ],
  globalSetup: "<rootDir>/test/jest.global-setup.ts",
  setupFilesAfterEnv: ["<rootDir>/test/jest.setup-after-env.js"],
  maxWorkers: 1, // equivalent to CLI --runInBand
  testMatch: ["**/*.test.ts"],
};
