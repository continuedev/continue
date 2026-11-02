import noBarrelFiles from "eslint-plugin-no-barrel-files";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "**/*.d.ts"] },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { project: ["tsconfig.json", "tsconfig.node.json"] },
    },
    // ESLint >= 9 reports unused eslint-disable comments by default; keep the old behavior
    linterOptions: { reportUnusedDisableDirectives: "off" },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "no-barrel-files": noBarrelFiles,
    },
    rules: {
      "@typescript-eslint/naming-convention": "off",
      "@typescript-eslint/no-floating-promises": "warn",
      // The old `"lint": "eslint --ext ts"` had no path, so it never linted anything and this
      // rule's "error" level was never enforced. There are 34 existing barrel files
      // (components/*/index.ts, ui/index.ts, ...); report them without failing CI.
      "no-barrel-files/no-barrel-files": "warn",
    },
  },
);
