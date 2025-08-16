---
name: Unit Testing Rules
description: Guidelines for unit testing in this project
alwaysApply: false
---

For unit testing in this project:

## 1. Testing frameworks

The project uses Vitest and Jest for testing. Prefer Vitest.

## 2. Test execution location

Run tests from within the specific package directory (e.g., `cd core && ..`).

## 3. Vitest tests

- Test files follow the pattern `*.vitest.ts`
- Run tests using `vitest` from within the specific package/module directory:
  ```bash
  cd [directory] && vitest -- [test file path]
  ```

## 4. Jest tests

- Test files follow the pattern `*.test.ts`
- Run tests using `npm test` from within the specific package/module directory:
  ```bash
  cd [directory] && npm test -- [test file path]
  ```
- The test script uses experimental VM modules via NODE_OPTIONS flag

## 5. Test structure

- Write tests as top-level `test()` functions - DO NOT use `describe()` blocks
- Include the function name being tested in the test description for clarity
