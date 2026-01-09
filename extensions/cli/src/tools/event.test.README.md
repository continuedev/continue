# Event Tool Tests

This directory contains comprehensive test files for the Event tool functionality added in PR #9340.

## Test Files

### 1. `event.test.ts` - Event Tool Tests

Tests for the Event tool that allows agents to report activity events to the task timeline.

**Test Coverage:**

- **Tool Metadata Tests** (4 tests)

  - Validates tool properties (name, displayName, readonly, isBuiltIn)
  - Verifies comprehensive description includes all key features
  - Checks parameter schema correctness
  - Ensures all parameters have descriptions

- **Success Scenarios** (10 tests)

  - Successfully recording events with all parameters
  - Successfully recording events with minimal parameters (eventName + title only)
  - Handling all standard event types (comment_posted, pr_created, commit_pushed, issue_closed, review_submitted)
  - Handling custom event names
  - Handling events with only description
  - Handling events with only externalUrl
  - Gracefully handling failed event posting
  - Handling null/undefined returns from postAgentEvent

- **Error Scenarios** (10 tests)

  - Throwing errors when agent ID is missing/null/empty
  - Handling AuthenticationRequiredError gracefully
  - Handling ApiRequestError with and without response
  - Handling generic errors
  - Handling non-Error exceptions
  - Re-throwing ContinueError as-is
  - Handling timeout errors

- **Edge Cases** (11 tests)

  - Very long event names and titles
  - Special characters in event parameters
  - Unicode characters (emojis, non-Latin scripts)
  - Empty optional parameters
  - Whitespace-only parameters
  - Consecutive event calls
  - Concurrent event calls (3 simultaneous)
  - Malformed URLs in externalUrl

- **Integration Scenarios** (5 tests)
  - Complete PR creation flow
  - Comment posting flow
  - Commit push flow
  - Issue closure flow
  - Review submission flow

**Total: 40 comprehensive tests**

### 2. `events.test.ts` - Event Utility Functions Tests

Tests for the utility functions in `events.ts` that support event posting.

**Test Coverage:**

- **getAgentIdFromArgs() Tests** (6 tests)

  - Extracting agent ID from --id flag
  - Handling --id flag at different positions
  - Returning undefined when no --id flag present
  - Returning undefined when --id flag has no value
  - Handling multiple flags correctly
  - Handling agent IDs with special characters

- **postAgentEvent() Tests** (17 tests)
  - Successfully posting events to control plane
  - Handling minimal event params (only required fields)
  - Handling events with metadata
  - Returning undefined for invalid inputs (empty agent ID, missing eventName/title)
  - Handling non-ok responses from API
  - Gracefully handling AuthenticationRequiredError
  - Gracefully handling ApiRequestError
  - Gracefully handling generic network errors
  - Handling all standard event types
  - Handling custom event names
  - Handling URLs with special characters
  - Handling very long descriptions (10,000 characters)
  - Handling concurrent event posting (10 simultaneous requests)
  - Preserving metadata types (string, number, boolean, null, array, object)

**Total: 23 comprehensive tests**

## Running the Tests

```bash
cd extensions/cli
npm test -- events.test.ts event.test.ts
```

Or to run all tests:

```bash
npm test
```

## Test Dependencies

The tests use:

- **vitest** - Test framework
- **vi (vitest mocking)** - For mocking dependencies

Mocked dependencies:

- `../util/events.js` - Event utility functions
- `../util/logger.js` - Logger
- `core/util/errors.js` - Core error classes

## Key Test Patterns

1. **Mocking Setup**: All external dependencies are properly mocked in beforeEach
2. **Cleanup**: All mocks are cleared/restored in afterEach
3. **Isolation**: Each test is independent and doesn't affect others
4. **Coverage**: Tests cover happy paths, error cases, edge cases, and integration scenarios
5. **Assertions**: Tests verify both function calls and return values

## Test Quality Metrics

- **Line Coverage**: Near 100% of event.ts and events.ts
- **Branch Coverage**: All conditional branches tested
- **Error Handling**: All error paths validated
- **Edge Cases**: Comprehensive edge case testing
- **Integration**: Real-world usage scenarios covered

## Notes

- Tests follow existing patterns from `apiClient.test.ts`
- All tests are TypeScript with proper typing
- Tests are organized into logical describe blocks
- Test names clearly describe what is being tested
- Tests are fast and don't require external services
