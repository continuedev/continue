import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import importPlugin from "eslint-plugin-import";
import unusedImports from "eslint-plugin-unused-imports";

export default [
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@typescript-eslint": tsPlugin,
      import: importPlugin,
      "unused-imports": unusedImports,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      // Core rules - all as errors
      "max-classes-per-file": ["error", 1],
      "prefer-const": "error",
      // "class-methods-use-this": [
      //   "error",
      //   {
      //     exceptMethods: [
      //       "render",
      //       "shouldComponentUpdate",
      //       "componentDidMount",
      //       "componentDidUpdate",
      //       "componentWillUnmount",
      //     ],
      //   },
      // ],
      "no-negated-condition": "error",
      "max-lines": [
        "error",
        { max: 500, skipBlankLines: true, skipComments: true },
      ],
      complexity: ["error", { max: 20 }],
      // "max-lines-per-function": [
      //   "error",
      //   { max: 150, skipBlankLines: true, skipComments: true },
      // ],
      "max-statements": ["error", { max: 50 }],
      "max-depth": ["error", { max: 4 }],
      "max-nested-callbacks": ["error", { max: 3 }],
      "max-params": ["error", { max: 5 }],
      eqeqeq: "error",

      // TypeScript specific rules
      // "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-explicit-any": "error",
      // "@typescript-eslint/member-ordering": [
      //   "error",
      //   {
      //     default: [
      //       // Static fields
      //       "public-static-field",
      //       "protected-static-field",
      //       "private-static-field",

      //       // Instance fields
      //       "public-instance-field",
      //       "protected-instance-field",
      //       "private-instance-field",

      //       // Constructors
      //       "constructor",

      //       // Static methods
      //       "public-static-method",
      //       "protected-static-method",
      //       "private-static-method",

      //       // Instance methods
      //       "public-instance-method",
      //       "protected-instance-method",
      //       "private-instance-method",
      //     ],
      //   },
      // ],

      // Import rules
      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          "newlines-between": "always",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
      "import/no-default-export": "error",

      // Unused code detection
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "error",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],

      // Turn off rules that might be too strict for CLI
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-non-null-assertion": "off",

      // Allow console for CLI tool
      "no-console": "off",
    },
    settings: {
      "import/resolver": {
        typescript: {
          project: "./tsconfig.json",
        },
        node: true,
      },
    },
  },
  {
    // Allow default exports in specific files
    files: ["src/index.ts", "*.config.js", "*.config.ts"],
    rules: {
      "import/no-default-export": "off",
    },
  },
  {
    // Test files can have different rules
    files: [
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "**/test-helpers/**/*.ts",
      "**/test-helpers/**/*.tsx",
      "**/__tests__/**/*.ts",
      "**/__tests__/**/*.tsx",
      "**/__mocks__/**/*.ts",
      "**/__mocks__/**/*.tsx",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "unused-imports/no-unused-vars": "off",
      "max-classes-per-file": "off",
      "max-lines": "off",
      "max-lines-per-function": "off",
      "max-statements": "off",
      complexity: "off",
      "class-methods-use-this": "off",
      "max-nested-callbacks": "off",
    },
  },
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "*.d.ts",
      "src/__mocks__/**",
      "vitest.config.ts",
      "*.config.js",
      "*.config.ts",
    ],
  },
];
