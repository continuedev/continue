import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";

import { sharedIgnores, sharedRules } from "../eslint.shared.js";

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
      // Core-specific overrides
      "@typescript-eslint/no-floating-promises": "error",
      "import/order": "off",
      curly: "off",
      eqeqeq: "error",
      quotes: "off",
      complexity: ["error", { max: 50 }],
      "max-lines-per-function": ["error", { max: 500 }],
      "max-statements": ["error", { max: 108 }],
      "max-depth": ["error", { max: 6 }],
      "max-nested-callbacks": ["error", { max: 4 }],
      "max-params": ["error", { max: 8 }],
    },
  },
  {
    files: [
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "**/*.vitest.ts",
    ],
    rules: {
      "max-lines-per-function": "off",
    },
  },
  {
    ignores: sharedIgnores,
  },
];
