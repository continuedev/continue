# Reactive Service Architecture Refactoring Plan

## Problem Statement

The current codebase has tightly coupled dependencies (config, apiClient, MCP service, model, etc.) that require full reloads when any component changes. This causes:

1. **Slow startup**: TUI can't start until all components are loaded
2. **Poor UX**: Slash commands like `/org`, `/config` trigger complete restarts  
3. **Tight coupling**: Can't change individual components without reloading everything
4. **Blocking initialization**: All dependencies must load before anything works

## Solution Overview

Implement a **Reactive Service Architecture** using:
- Custom ServiceContainer with Node.js EventEmitter
- React hooks for service consumption
- Progressive loading and error handling
- Independent service lifecycle management

## Current Architecture Analysis

### Key Components to Refactor
- **Config Management** (`src/config.ts`, `src/onboarding.ts`)
- **Authentication** (`src/auth/workos.ts`) 
- **LLM/Model handling** (`src/config.ts` - `initializeLlmApi()`)
- **MCP Service** (`src/mcp.ts`)
- **API Client** (`src/CLIPlatformClient.ts`)

### Current Initialization Flow
```
chat() -> initializeChat() -> initializeWithOnboarding() -> initialize() 
  -> Returns: { config, llmApi, model, mcpService, apiClient }
  -> startTUIChat() with all dependencies
```

### Current Problem Areas
- `src/commands/chat.ts` - `initializeChat()` loads everything synchronously
- `src/ui/index.ts` - `startTUIChat()` requires all deps upfront
- `src/slashCommands.ts` - `/config`, `/login` trigger full reloads via `onReload()`
- `src/ui/TUIChat.tsx` - Assumes all services are available at startup

## Implementation Strategy

### Phase 1: Extract Current Initialization into Services ✅ TODO
Create the service infrastructure and extract existing initialization logic.

#### 1.1 Create Service Infrastructure
- [ ] Create `src/services/ServiceContainer.ts` - Core service management
- [ ] Create `src/hooks/useService.ts` - React hook for service consumption
- [ ] Create `src/services/types.ts` - Service-related TypeScript types

#### 1.2 Create Individual Services
- [ ] Create `src/services/AuthService.ts` - Extract auth logic from `src/auth/workos.ts`
- [ ] Create `src/services/ConfigService.ts` - Extract config logic from `src/config.ts`
- [ ] Create `src/services/ModelService.ts` - Extract model initialization
- [ ] Create `src/services/MCPService.ts` - Extract MCP logic from `src/mcp.ts`
- [ ] Create `src/services/ApiClientService.ts` - Extract API client management

#### 1.3 Create Service Registry
- [ ] Create `src/services/index.ts` - Central service registry and initialization
- [ ] Add service dependency management (e.g., ModelService depends on ConfigService)

### Phase 2: Make TUI Reactive to Service Changes ✅ TODO
Update the TUI to consume services reactively instead of requiring all deps upfront.

#### 2.1 Update TUI Components
- [ ] Update `src/ui/TUIChat.tsx` - Use `useService` hooks instead of props
- [ ] Add loading states for individual services
- [ ] Add error boundaries for service failures
- [ ] Remove service props from component interface

#### 2.2 Update TUI Entry Point
- [ ] Update `src/ui/index.ts` - Remove dependency injection, just start TUI
- [ ] Update `src/commands/chat.ts` - Start TUI immediately, services load async

#### 2.3 Handle Service Dependencies in UI
- [ ] Show progressive loading (e.g., "Config loaded, loading model...")
- [ ] Handle missing services gracefully
- [ ] Allow partial functionality when some services unavailable

### Phase 3: Update Slash Commands to Use Services ✅ TODO
Make slash commands reactive by updating services instead of triggering reloads.

#### 3.1 Update Slash Command Handlers
- [ ] Update `src/slashCommands.ts` - Remove `onReload` callback pattern
- [ ] Update `/config` command to use ConfigService.switchConfig()
- [ ] Update `/login` command to use AuthService.login()
- [ ] Update `/logout` command to use AuthService.logout()
- [ ] Add `/org` command to use AuthService.switchOrg()

#### 3.2 Remove Reload Mechanisms
- [ ] Remove `onReload` callbacks from TUIChat
- [ ] Remove full restart logic from slash commands
- [ ] Services now auto-propagate changes to UI

### Phase 4: Add Progressive Loading and Better Error Handling ✅ TODO
Enhance the user experience with better loading states and error recovery.

#### 4.1 Enhanced Loading States
- [ ] Add service loading indicators in TUI
- [ ] Show which services are loading/ready
- [ ] Allow using available functionality while other services load

#### 4.2 Error Handling and Recovery
- [ ] Add retry mechanisms for failed service initialization
- [ ] Add service health monitoring
- [ ] Graceful degradation when services fail
- [ ] Better error messages for specific service failures

#### 4.3 Performance Optimizations
- [ ] Lazy load services only when needed
- [ ] Cache service results appropriately
- [ ] Debounce rapid service changes

## File Changes Required

### New Files
- `src/services/ServiceContainer.ts`
- `src/services/types.ts` 
- `src/services/AuthService.ts`
- `src/services/ConfigService.ts`
- `src/services/ModelService.ts`
- `src/services/MCPService.ts`
- `src/services/ApiClientService.ts`
- `src/services/index.ts`
- `src/hooks/useService.ts`

### Modified Files
- `src/commands/chat.ts` - Remove synchronous initialization
- `src/ui/index.ts` - Remove dependency injection
- `src/ui/TUIChat.tsx` - Use service hooks instead of props
- `src/slashCommands.ts` - Use services instead of reload callbacks
- `src/onboarding.ts` - Integrate with service architecture

### Files to Analyze for Extraction
- `src/config.ts` - Extract initialization logic
- `src/auth/workos.ts` - Extract auth management
- `src/mcp.ts` - Extract MCP service logic

## Success Criteria

### Phase 1 Success
- [ ] Services can be initialized independently
- [ ] Existing functionality works through service layer
- [ ] No breaking changes to current behavior

### Phase 2 Success  
- [ ] TUI starts immediately without waiting for all services
- [ ] UI updates reactively when services load/change
- [ ] Loading states provide clear user feedback

### Phase 3 Success
- [ ] Slash commands work without full reloads
- [ ] `/config` and `/login` commands update UI instantly
- [ ] No more blocking reinitialization

### Phase 4 Success
- [ ] Better error handling for service failures
- [ ] Progressive enhancement - partial functionality available
- [ ] Improved startup performance

## Testing Strategy

### Unit Tests
- [ ] Test each service in isolation
- [ ] Test service dependencies and lifecycle
- [ ] Test React hooks with service changes

### Integration Tests
- [ ] Test service interactions
- [ ] Test UI updates with service changes
- [ ] Test slash command service updates

### E2E Tests  
- [ ] Test full user flows with new architecture
- [ ] Test error recovery scenarios
- [ ] Test performance improvements

## Migration Strategy

1. **Backward Compatibility**: Ensure existing functionality works during transition
2. **Incremental Migration**: Each phase should be deployable independently
3. **Rollback Plan**: Keep old initialization as fallback during Phase 1-2
4. **Monitoring**: Add logging to track service lifecycle and performance

## Risk Mitigation

### Technical Risks
- **Service dependency cycles**: Use dependency injection pattern
- **Memory leaks**: Proper EventEmitter cleanup in React hooks
- **Race conditions**: Use proper async/await patterns in services

### User Experience Risks
- **Broken functionality during migration**: Extensive testing at each phase
- **Performance regressions**: Benchmark before/after each phase
- **Confusing loading states**: Clear UX design for progressive loading

## Notes

- Start with Phase 1 to establish the foundation
- Each phase should be fully tested before proceeding
- Consider feature flags for gradual rollout
- Document service APIs clearly for future development