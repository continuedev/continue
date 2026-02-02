/**
 * Shared ESLint rules - equivalent to the old .eslintrc.shared.json
 * Import this and spread into your config, then add plugins/parser locally.
 */
export const sharedRules = {
  "no-negated-condition": "warn",
  "@typescript-eslint/naming-convention": "off",
  "@typescript-eslint/no-floating-promises": "warn",
  "@typescript-eslint/no-misused-promises": "error",
  curly: "warn",
  eqeqeq: "warn",
  "no-throw-literal": "warn",
  semi: "off",
  "import/order": [
    "warn",
    {
      groups: [
        "builtin",
        "external",
        "internal",
        "parent",
        "sibling",
        "index",
        "object",
        "type",
      ],
      alphabetize: {
        order: "asc",
        caseInsensitive: true,
      },
      "newlines-between": "always",
    },
  ],
};

export const sharedIgnores = ["out/**", "dist/**", "**/*.d.ts"];

export default { sharedRules, sharedIgnores };
