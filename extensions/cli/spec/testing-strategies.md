# Testing Strategies

This document provides an overview of the different testing strategies used in this repository, when to use each type, and links to examples.

## Test Types

### 1. Unit Tests

**Purpose**: Test individual functions, utilities, and modules in isolation.

**When to use**:

- Testing pure functions with predictable inputs/outputs
- Testing utility functions and helpers
- Testing business logic components
- Testing error handling and edge cases

**Framework**: Vitest with TypeScript support

**Examples**:

- [`src/util/formatError.test.ts`](../src/util/formatError.test.ts) - Tests error formatting utility
- [`src/util/exponentialBackoff.test.ts`](../src/util/exponentialBackoff.test.ts) - Tests backoff logic
- [`src/logging.test.ts`](../src/logging.test.ts) - Tests logging functionality
- [`src/args.test.ts`](../src/args.test.ts) - Tests argument parsing

**How to run**: `npm test` (includes linting)

### 2. Service Tests

**Purpose**: Test service classes and dependency injection system.

**When to use**:

- Testing service initialization and lifecycle
- Testing service dependencies and injection
- Testing service container behavior
- Testing service configuration loading

**Examples**:

- [`src/services/ServiceContainer.test.ts`](../src/services/ServiceContainer.test.ts) - Tests dependency injection
- [`src/services/ConfigService.test.ts`](../src/services/ConfigService.test.ts) - Tests configuration loading
- [`src/services/circular-dependencies.test.ts`](../src/services/circular-dependencies.test.ts) - Tests circular dependency detection

### 3. UI Component Tests

**Purpose**: Test React components using Ink testing library for terminal UI.

**When to use**:

- Testing component rendering and display
- Testing user interactions and input handling
- Testing component state changes
- Testing message display and formatting

**Framework**: Vitest + Ink Testing Library + React Testing utilities

**Examples**:

- [`src/ui/__tests__/TUIChat.basic.test.tsx`](../src/ui/__tests__/TUIChat.basic.test.tsx) - Basic rendering tests
- [`src/ui/__tests__/TUIChat.messages.test.tsx`](../src/ui/__tests__/TUIChat.messages.test.tsx) - Message display tests
- [`src/ui/__tests__/TUIChat.input.test.tsx`](../src/ui/__tests__/TUIChat.input.test.tsx) - Input handling tests
- [`src/ui/MarkdownRenderer.test.tsx`](../src/ui/MarkdownRenderer.test.tsx) - Markdown rendering tests

**Test Checklist**: See [`src/ui/UI_TEST_CHECKLIST.md`](../src/ui/UI_TEST_CHECKLIST.md) for comprehensive UI testing guidelines.

### 4. E2E (End-to-End) Tests

**Purpose**: Test complete user workflows and CLI behavior in realistic scenarios.

**When to use**:

- Testing full CLI command execution
- Testing authentication flows
- Testing configuration loading and switching
- Testing tool execution and responses
- Testing headless and interactive modes

**Examples**:

- [`src/e2e/auth.test.ts`](../src/e2e/auth.test.ts) - Authentication workflows
- [`src/e2e/basic-commands.test.ts`](../src/e2e/basic-commands.test.ts) - Basic CLI commands
- [`src/e2e/headless-tool-calls.test.ts`](../src/e2e/headless-tool-calls.test.ts) - Tool execution in headless mode
- [`src/e2e/config-switching.test.tsx`](../src/e2e/config-switching.test.tsx) - Configuration switching

## Testing Infrastructure

### Test Helpers

**Service Container Testing**:

- [`src/test-helpers/testServiceContainer.ts`](../src/test-helpers/testServiceContainer.ts) - Mock service container setup
- [`src/test-helpers/ui-test-context.ts`](../src/test-helpers/ui-test-context.ts) - UI test context setup

**CLI Testing**:

- Test helpers in [`src/test-helpers/`](../src/test-helpers/) for CLI command execution

### Mocks

**UI Mocks**: [`src/ui/__mocks__/`](../src/ui/__mocks__/)

- Syntax highlighter mocks
- Component mocks for testing

**Service Mocks**: [`src/__mocks__/`](../src/__mocks__/)

- Authentication mocks
- Service mocks
- Logging mocks

## Configuration

**Vitest Configuration**: [`vitest.config.ts`](../vitest.config.ts)

- TypeScript support with ES modules
- React/Ink component testing setup
- Mock configurations
- Test timeout and environment settings

## Running Tests

```bash
# Run all tests with linting
npm test

# Run tests in watch mode
npx vitest --watch

# Run specific test file
npx vitest src/util/formatError.test.ts

# Run tests with coverage
npx vitest --coverage
```

## Best Practices

1. **Unit Tests**: Focus on pure functions and isolated logic
2. **Service Tests**: Test dependency injection and service lifecycle
3. **UI Tests**: Test user-visible behavior, not implementation details
4. **E2E Tests**: Test complete user workflows and CLI behavior

5. **Keep tests focused**: One behavior per test
6. **Use descriptive names**: Test names should explain what's being tested
7. **Minimal mocking**: Only mock external dependencies and APIs
8. **Test error cases**: Include negative test cases and edge conditions
9. **Maintain test isolation**: Each test should be independent
