# RequestId Integration & Error Handling Standardization Plan

## Overview
This document outlines the implementation plan for passing `requestId` from the fetch layer to the StreamError dialog and standardizing error handling across the Continue codebase.

## Implementation Strategy

### Phase 1: Foundation ✅ COMPLETED
- [x] **1.1** Create new shared error handling package (`@continuedev/errors`)
- [x] **1.2** Define `ContinueError` class with standard fields:
  - `message: string`
  - `code?: string` 
  - `requestId?: string`
  - `statusCode?: number`
  - `metadata?: Record<string, any>`
  - `originalError?: unknown`
- [x] **1.3** Export core error utilities and type definitions (simplified approach)
- [x] **1.4** Update fetch layer to create structured errors with requestId
- [x] **1.5** Enhance `analyzeError` function to handle new error structure
- [x] **1.6** Update `parseError` method in core/llm to thread requestId through

### Phase 2: Propagation ✅ COMPLETED
- [x] **2.1** Update LLM models to preserve error structure
  - [x] BaseLLM parseError method updated to use ContinueError
  - [x] RequestId captured from response headers
  - [x] Minimal changes to preserve existing logic
- [x] **2.2** Error propagation maintained through existing thunk system
  - [x] Errors flow through streamResponseThunk unchanged
  - [x] streamThunkWrapper handles both legacy and new errors
  - [x] Redux error handling preserved
- [x] **2.3** Update StreamError dialog to display requestId
  - [x] Add requestId to error analysis interface
  - [x] Include requestId in GitHub issue template
  - [x] Add copy requestId functionality in technical details
  - [x] Show requestId prominently in expandable section

### Phase 3: Future Standardization (Optional)
- [ ] **3.1** Migrate remaining error creation points (as needed)
  - [ ] Context providers
  - [ ] Slash commands
  - [ ] Data logger
  - [ ] Control plane operations
- [ ] **3.2** Add comprehensive error validation and testing (as needed)
  - [x] Unit tests for ContinueError class (basic coverage)
  - [ ] Integration tests for error flow
  - [ ] Error backwards compatibility tests
- [ ] **3.3** Update telemetry to include requestId (future enhancement)
  - [ ] PostHog error events
  - [ ] Error metadata standardization
  - [ ] Analytics for error tracking

## Technical Details

### Error Class Structure
```typescript
class ContinueError extends Error {
  code?: string;
  requestId?: string;
  statusCode?: number;
  metadata?: Record<string, any>;
  originalError?: unknown;
}
```

### Error Flow ✅ IMPLEMENTED
```
HTTP Response → parseError() → ContinueError(message, { requestId, statusCode }) → analyzeError() → StreamError Dialog
```

### Backwards Compatibility ✅ MAINTAINED
- ✅ Support both old string errors and new structured errors during transition
- ✅ Graceful degradation when requestId is not available
- ✅ Preserve existing error analysis functionality
- ✅ Minimal changes to existing codebase

## Key Considerations

### Performance
- Structured errors have minimal overhead
- Lazy error analysis for better performance
- Avoid deep object copying in error propagation

### User Experience
- RequestId copyable and included in GitHub issues automatically
- Show requestId prominently for support scenarios
- Maintain existing error dialog functionality

### Maintainability
- Type-safe error handling
- Consistent error creation patterns
- Clear error metadata structure

## Success Criteria ✅ ACHIEVED

- [x] RequestId is available in StreamError dialog when present
- [x] GitHub issue reports automatically include requestId
- [x] Core error creation points use ContinueError class (fetch, stream, parseError)
- [x] Backwards compatibility maintained during transition
- [x] Basic test coverage for error flow
- [ ] Error telemetry includes structured metadata (future enhancement)
- [ ] Comprehensive end-to-end error testing (future enhancement)

## Implementation Summary ✅ COMPLETED

### What Was Implemented:
1. **@continuedev/errors package** - Simple, focused error handling with ContinueError class
2. **RequestId threading** - From HTTP response headers through to StreamError dialog
3. **Minimal changes approach** - Preserved existing error logic while adding requestId support
4. **UI integration** - RequestId displayed in error dialog with copy functionality
5. **GitHub issue integration** - RequestId automatically included in error reports

### Key Benefits Achieved:
- ✅ **Enhanced debugging** - RequestId available for support scenarios
- ✅ **Improved user experience** - Clear error reporting with actionable information
- ✅ **Minimal disruption** - Existing error handling preserved
- ✅ **Type safety** - Structured error handling with TypeScript support
- ✅ **Backwards compatibility** - Works with both old and new error types

### Architecture:
```
HTTP Response (x-request-id header) 
    ↓
parseError() captures requestId
    ↓
ContinueError(message, { requestId, statusCode })
    ↓
analyzeError() extracts requestId
    ↓
StreamError dialog displays requestId + GitHub issue integration
```

---

*Implementation completed with simplified, maintainable approach that achieves core objectives.*