import path from "path";
import { fileURLToPath } from "url";

export default {
  transform: {
    "\\.[jt]sx?$": ["ts-jest", { useESM: true }],
  },
  testMatch: ["<rootDir>/src/**/*.test.{js,jsx,ts,tsx}"],

  moduleNameMapper: {
    "(.+)\\.js": "$1",
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
