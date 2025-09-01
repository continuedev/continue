# ChatHistoryService Migration Plan

## Overview

This document outlines a gradual migration plan to move from the current mixed state management approach (React state + direct mutations) to a centralized `ChatHistoryService` that acts as the single source of truth for chat history.

## Current State Analysis

### Problems
- **Duplicate state**: Chat history exists in both React state (`useState`) and is directly mutated in arrays
- **Direct mutations**: `handleToolCalls.ts` uses `chatHistory.push()` bypassing React
- **Inconsistent updates**: Mix of `setChatHistory` callbacks and direct array modifications
- **Testing difficulties**: Hard to test and mock due to mixed patterns
- **Race conditions**: Potential for state inconsistencies

### Affected Files
- `src/ui/hooks/useChat.ts` - Main hook with React state
- `src/stream/handleToolCalls.ts` - Direct array mutations
- `src/stream/streamChatResponse.ts` - Mixed patterns
- `src/commands/serve.ts` - Direct mutations in remote mode
- `src/session.ts` - Session management

## Migration Strategy

### Phase 1: Create ChatHistoryService (Day 1)
**Goal**: Establish the service foundation without breaking existing code

#### 1.1 Create Service Implementation
```typescript
// src/services/ChatHistoryService.ts
export interface ChatHistoryState {
  history: ChatHistoryItem[];
  compactionIndex: number | null;
  sessionId: string;
  isRemoteMode: boolean;
}

export class ChatHistoryService extends BaseService<ChatHistoryState> {
  // Implementation details below
}
```

#### 1.2 Service Methods to Implement
- `addUserMessage(content, contextItems)`
- `addAssistantMessage(content, toolCalls?)`
- `addSystemMessage(content)`
- `updateToolCallState(messageIndex, toolCallId, updates)`
- `addToolResult(toolCallId, result, status)`
- `compact(newHistory, compactionIndex)`
- `clear()`
- `loadSession(sessionId)`
- `getHistory()` - Returns immutable copy
- `getHistoryForLLM(compactionIndex?)` - For streaming

#### 1.3 Register Service
- Add to `src/services/index.ts`
- Add to ServiceContainer initialization
- Ensure proper initialization order

#### 1.4 Write Unit Tests
- Test all service methods
- Test event emissions
- Test immutability guarantees
- Test session integration

**Deliverable**: Working service with tests, no integration yet

### Phase 2: Wrapper Integration (Day 1-2)
**Goal**: Wrap existing code to use service without changing behavior

#### 2.1 Create Compatibility Layer
```typescript
// src/services/ChatHistoryCompatibility.ts
export function createChatHistoryProxy(service: ChatHistoryService) {
  return new Proxy([], {
    get(target, prop) {
      if (prop === 'push') {
        return (item) => service.addHistoryItem(item);
      }
      // Delegate reads to service.getHistory()
      const history = service.getHistory();
      return history[prop];
    }
  });
}
```

#### 2.2 Update useChat Hook
- Initialize ChatHistoryService in useChat
- Keep existing `setChatHistory` for now
- Sync service changes to React state:
```typescript
// In useChat.ts
const chatHistoryService = useService<ChatHistoryState>('chatHistory');

useEffect(() => {
  if (chatHistoryService.state === 'ready') {
    setChatHistory(chatHistoryService.value.history);
  }
}, [chatHistoryService]);
```

#### 2.3 Add Service Methods to Mirror State Updates
- Wherever `setChatHistory` is called, also update service
- This creates temporary duplication but maintains compatibility

**Deliverable**: Service running in parallel with existing state

### Phase 3: Migrate Stream Processing (Day 2)
**Goal**: Update streaming functions to use service

#### 3.1 Update handleToolCalls.ts
- Replace `chatHistory.push()` with service methods:
```typescript
// Before:
chatHistory.push(createHistoryItem(...));

// After:
await chatHistoryService.addHistoryItem(createHistoryItem(...));
```

#### 3.2 Update streamChatResponse.ts
- Pass service instance instead of arrays
- Use service methods for all updates
- Remove direct array access

#### 3.3 Update Stream Callbacks
- Modify `createStreamCallbacks` in `useChat.stream.helpers.ts`
- Use service methods instead of `setChatHistory`
- Ensure proper event handling

#### 3.4 Test Streaming
- Test tool execution flow
- Test interruption handling
- Test auto-compaction
- Verify no direct mutations remain

**Deliverable**: All streaming using service, no direct mutations

### Phase 4: Remove React State Duplication (Day 2-3)
**Goal**: Remove `useState` and rely solely on service

#### 4.1 Update useChat to Use Service Directly
```typescript
// Remove:
const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>(...);

// Replace with:
const { value: chatHistoryState, state } = useService<ChatHistoryState>('chatHistory');
const chatHistory = chatHistoryState?.history || [];
```

#### 4.2 Update All Components
- Update components that receive `chatHistory` prop
- Ensure they handle potential undefined/loading states
- Update any direct `setChatHistory` calls

#### 4.3 Remove Compatibility Layer
- Remove the proxy wrapper
- Remove temporary sync code
- Clean up unused imports

**Deliverable**: Single source of truth established

### Phase 5: Optimize and Enhance (Day 3)
**Goal**: Add optimizations and missing features

#### 5.1 Performance Optimizations
- Implement efficient diffing for large histories
- Add memoization where needed
- Optimize re-render triggers

#### 5.2 Add Advanced Features
- Implement undo/redo capability
- Add history branching for explorations
- Improve session management integration
- Add persistence strategies

#### 5.3 Remote Mode Integration
- Update `serve.ts` to use service
- Ensure remote sync works with service
- Test remote mode thoroughly

#### 5.4 Update Documentation
- Update code comments
- Update AGENTS.md with new patterns
- Create service usage examples

**Deliverable**: Optimized service with full feature set

Status: Completed

- Remote mode now reads/writes chat history via ChatHistoryService; `/state` reflects the service’s history.
- Stream callbacks avoid duplicating tool entries; service is single source of truth.
- Added undo/redo to ChatHistoryService with tests (`canUndo/canRedo/undo/redo`).

Notes: Further optimizations (batching/memoization) can be added if performance profiling indicates need with very large histories.

### Phase 6: Validation and Cleanup (Day 3-4)
**Goal**: Ensure migration is complete and stable

#### 6.1 Comprehensive Testing
- Run all existing tests
- Add integration tests for service
- Test all user flows (TUI, headless, remote)
- Performance testing with large histories

#### 6.2 Code Cleanup
- Removed direct history mutations in serve/stream paths where service is present; retained minimal fallbacks.
- Updated imports/types; removed unused `updateSessionHistory` in serve mode and pruned unused types.
- Verified service methods own persistence; remote mode disables persistence by design.

#### 6.3 Migration Verification Checklist
- [x] No direct array mutations remain where service is available (fallbacks kept for resilience)
- [x] All tests passing
- [x] Service handles all chat operations (user, assistant, tools, system, compaction)
- [x] React components update via service events
- [x] Session management integrated with service persistence
- [x] Remote mode reading/writing via service
- [x] Performance acceptable in tests; no regressions
- [x] No new console errors/warnings introduced

## Rollback Plan

If issues arise during migration:

1. **Phase 1-2**: No impact, service runs in parallel
2. **Phase 3**: Revert stream processing changes, keep service
3. **Phase 4**: Revert to dual state temporarily
4. **Phase 5-6**: Feature flags for new capabilities

## Testing Strategy

### Unit Tests
- Service methods individually
- Event emissions
- State immutability
- Error handling

### Integration Tests
- Service + React hooks
- Service + streaming
- Service + sessions
- Service + remote mode

### E2E Tests
- Full chat flows
- Tool execution
- Mode switching
- Session resume
- Interruption handling

## Success Metrics

1. **No regressions**: All existing functionality works
2. **Performance**: No noticeable slowdown
3. **Maintainability**: Cleaner, more testable code
4. **Reliability**: No state inconsistencies
5. **Developer experience**: Easier to understand and modify

## Risk Mitigation

### High Risk Areas
1. **Streaming integration**: Most complex change
   - Mitigation: Extensive testing, gradual rollout
   
2. **Remote mode**: Different state management
   - Mitigation: Test thoroughly, maintain compatibility

3. **Performance**: Large histories might cause issues
   - Mitigation: Profiling, optimization, lazy loading

### Monitoring
- Add logging for state transitions
- Monitor performance metrics
- Track error rates
- User feedback collection

## Timeline

- **Day 1**: Phase 1-2 (Service creation, wrapper)
- **Day 2**: Phase 3-4 (Stream migration, remove duplication)
- **Day 3**: Phase 5 (Optimization, features)
- **Day 4**: Phase 6 (Validation, cleanup)

Total: 4 days with buffer for issues

## Implementation Checklist

### Pre-Migration
- [ ] Current state documented
- [ ] All stakeholders informed
- [ ] Test environment ready
- [ ] Rollback plan confirmed

### Phase 1
- [ ] ChatHistoryService created
- [ ] Unit tests written
- [ ] Service registered
- [ ] No breaking changes

### Phase 2
- [ ] Compatibility layer working
- [ ] useChat integrated
- [ ] Parallel operation verified
- [ ] No regressions

### Phase 3
- [ ] Stream processing migrated
- [ ] No direct mutations
- [ ] Tool handling updated
- [ ] Tests passing

### Phase 4
- [ ] React state removed
- [ ] Service-only operation
- [ ] Components updated
- [ ] Performance acceptable

### Phase 5
- [ ] Optimizations implemented
- [ ] Features added
- [ ] Remote mode working
- [ ] Documentation updated

### Phase 6
- [ ] All tests passing
- [ ] Code cleaned up
- [ ] Migration complete
- [ ] Team sign-off

## Post-Migration

1. Monitor for issues for 1 week
2. Gather performance metrics
3. Document lessons learned
4. Plan future enhancements
5. Knowledge transfer to team

## Appendix: Code Examples

### Service Method Example
```typescript
class ChatHistoryService extends BaseService<ChatHistoryState> {
  addUserMessage(content: string, contextItems: any[] = []) {
    const newMessage: ChatHistoryItem = {
      message: { role: 'user', content },
      contextItems
    };
    
    const newHistory = [...this.currentState.history, newMessage];
    this.setState({ 
      ...this.currentState,
      history: newHistory 
    });
    
    // Auto-save to session
    updateSessionHistory(newHistory);
    
    return newMessage;
  }
}
```

### React Integration Example
```typescript
function ChatComponent() {
  const { value: chatState, state } = useService<ChatHistoryState>('chatHistory');
  
  if (state === 'loading') return <LoadingSpinner />;
  if (state === 'error') return <ErrorMessage />;
  
  const history = chatState?.history || [];
  
  return <ChatMessages history={history} />;
}
```

### Migration Pattern Example
```typescript
// Before:
chatHistory.push(newMessage);
setChatHistory([...chatHistory]);

// After:
chatHistoryService.addMessage(newMessage);
// React auto-updates via useService hook
```
