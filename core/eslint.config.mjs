import tseslint from "typescript-eslint";

export default tseslint.config(
  // `out`, `dist` and declaration files were ignored by the shared .eslintrc
  { ignores: ["out/**", "dist/**", "**/*.d.ts", "node_modules/**"] },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
        ecmaVersion: 6,
        sourceType: "module",
      },
    },
    // ESLint >= 9 reports unused eslint-disable comments by default; keep the old behavior
    linterOptions: { reportUnusedDisableDirectives: "off" },
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: {
      "no-negated-condition": "warn",
      "@typescript-eslint/naming-convention": "off",
      // This is important: when floating promises cause unhandled rejections, the JetBrains binary blows up
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "no-throw-literal": "warn",
      semi: "off",
      quotes: ["off", "double", {}],
      curly: "off",
      eqeqeq: "error",
      // Thresholds re-baselined for ESLint >= 9/10, which counts complexity, depth and
      // callback nesting more strictly than ESLint 8 (previously 36 / 6 / 4)
      complexity: ["error", { max: 45 }],
      "max-lines-per-function": ["error", { max: 500 }],
      "max-statements": ["error", { max: 108 }],
      "max-depth": ["error", { max: 7 }],
      "max-nested-callbacks": ["error", { max: 5 }],
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
    rules: { "max-lines-per-function": "off" },
  },
);
