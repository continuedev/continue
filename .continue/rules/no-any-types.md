---
globs: "**/*.{ts,tsx}"
---

Avoid using the `any` type wherever possible. Use unknown or find the correct type. The only acceptable place to use any is when typecasting for test mocks, and even then it's better to avoid and provide a proper mock.
