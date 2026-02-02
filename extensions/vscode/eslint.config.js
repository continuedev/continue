import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";

import { sharedIgnores, sharedRules } from "../../eslint.shared.js";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@typescript-eslint": tsPlugin,
      import: importPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 6,
        sourceType: "module",
        project: "./tsconfig.json",
      },
    },
    rules: {
      ...sharedRules,
      // VSCode-specific overrides
      "@typescript-eslint/no-misused-promises": "warn",
    },
  },
  {
    ignores: sharedIgnores,
  },
];
