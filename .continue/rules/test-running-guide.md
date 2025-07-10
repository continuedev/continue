---
globs: '["gui/**/*", "core/**/*"]'
description: Provides test running instructions for GUI and core folders
alwaysApply: false
---

When working with test files, use the following commands to run tests:

GUI folder tests:
- Run all tests: `cd gui && npm test`

Core folder tests:
- Run Jest tests: `cd core && npm test`
- Run Vitest tests: `cd core && npm run vitest`

Test file patterns:
- GUI: *.test.ts or *.test.tsx files use Vitest
- Core: *.test.ts files use Jest, *.vitest.ts files use Vitest

Best practices:
- We are transitioning to vitest, so use that when creating new tests