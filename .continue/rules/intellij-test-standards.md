---
name: IntelliJ Test Standards
description: Standards for writing tests in the IntelliJ plugin
alwaysApply: false
globs: "**/test/**/*.kt"
---

When writing tests for the IntelliJ plugin:

## Use mockk library for mocking

Prefer mockk's idiomatic syntax for creating and verifying mocks.

## Structure tests with clear patterns

Always structure tests with clear Arrange-Act-Assert patterns.

## Use descriptive test names

Use descriptive test names that indicate the scenario being tested.
