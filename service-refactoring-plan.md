# Service Architecture Refactoring Plan

## Goals
1. **Re-introduce local mode tests** instead of relying on remote mode workaround
2. **Make services injectable** via React Context for better test isolation
3. **Control async timing** in tests while keeping production behavior unchanged

## Phase 1: Add React Context for Service Container (Minimal Breaking Changes)

### 1.1 Create ServiceContainerContext
```typescript
// src/services/ServiceContainerContext.tsx
import React, { createContext, useContext } from 'react';
import { ServiceContainer } from './ServiceContainer.js';
import { serviceContainer as defaultContainer } from './index.js';

const ServiceContainerContext = createContext<ServiceContainer>(defaultContainer);

export function ServiceContainerProvider({ 
  children, 
  container = defaultContainer 
}: { 
  children: React.ReactNode;
  container?: ServiceContainer;
}) {
  return (
    <ServiceContainerContext.Provider value={container}>
      {children}
    </ServiceContainerContext.Provider>
  );
}

export function useServiceContainer() {
  return useContext(ServiceContainerContext);
}
```

### 1.2 Update useService/useServices hooks
```typescript
// src/hooks/useService.ts
export function useService<T>(serviceName: string): ServiceResult<T> & {
  reload: () => Promise<void>;
} {
  const container = useServiceContainer(); // NEW: Get from context
  const [result, setResult] = useState<ServiceResult<T>>(() => 
    container.getSync<T>(serviceName)
  );
  // ... rest remains the same
}
```

### 1.3 Wrap app with provider
```typescript
// src/index.tsx or app entry point
<ServiceContainerProvider>
  <App />
</ServiceContainerProvider>
```

## Phase 2: Create Test Utilities

### 2.1 Test Service Container Factory
```typescript
// src/test-helpers/testServiceContainer.ts
import { ServiceContainer } from '../services/ServiceContainer.js';

export interface TestServiceContainer extends ServiceContainer {
  waitForReady(...serviceNames: string[]): Promise<void>;
  waitForService(serviceName: string): Promise<any>;
  resolveService(serviceName: string, value: any): void;
  rejectService(serviceName: string, error: Error): void;
}

export function createTestServiceContainer(): TestServiceContainer {
  const container = new ServiceContainer() as TestServiceContainer;
  const serviceResolvers = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }>();
  
  // Track service promises
  const originalRegister = container.register.bind(container);
  container.register = function(name, factory, deps) {
    // Create a controllable factory
    const controlledFactory = () => {
      return new Promise((resolve, reject) => {
        serviceResolvers.set(name, { resolve, reject });
      });
    };
    
    return originalRegister(name, controlledFactory, deps);
  };
  
  // Helper to resolve a service on demand
  container.resolveService = function(name, value) {
    const resolver = serviceResolvers.get(name);
    if (resolver) {
      resolver.resolve(value);
    }
  };
  
  // Helper to reject a service
  container.rejectService = function(name, error) {
    const resolver = serviceResolvers.get(name);
    if (resolver) {
      resolver.reject(error);
    }
  };
  
  // Wait for specific services to be ready
  container.waitForReady = async function(...names) {
    const promises = names.map(name => 
      new Promise<void>(resolve => {
        container.once(`${name}:ready`, () => resolve());
        container.once(`${name}:error`, () => resolve());
      })
    );
    await Promise.all(promises);
  };
  
  return container;
}
```

### 2.2 React Testing Utilities
```typescript
// src/test-helpers/renderWithServices.tsx
import { render } from 'ink-testing-library';
import { ServiceContainerProvider } from '../services/ServiceContainerContext.js';
import { createTestServiceContainer } from './testServiceContainer.js';

export function renderWithServices(
  ui: React.ReactElement,
  options?: {
    services?: Record<string, any>;
    container?: TestServiceContainer;
  }
) {
  const container = options?.container || createTestServiceContainer();
  
  // Register default services if provided
  if (options?.services) {
    Object.entries(options.services).forEach(([name, value]) => {
      container.register(name, () => Promise.resolve(value));
    });
  }
  
  const rendered = render(
    <ServiceContainerProvider container={container}>
      {ui}
    </ServiceContainerProvider>
  );
  
  return {
    ...rendered,
    container,
  };
}
```

## Phase 3: Migrate Tests from Remote to Local Mode

### 3.1 Update Individual Test Files
Convert each test file from remote mode to local mode with proper service mocking.

#### Example Migration
```typescript
// BEFORE: src/ui/__tests__/TUIChat.messages.test.tsx
it("displays empty chat correctly", () => {
  const { lastFrame } = render(<TUIChat remoteUrl="http://localhost:3000" />);
  // ...
});

// AFTER:
it("displays empty chat correctly", async () => {
  const { lastFrame, container } = renderWithServices(<TUIChat />, {
    services: {
      auth: { isAuthenticated: true },
      config: { config: mockConfig },
      model: { model: mockModel, llmApi: mockLlmApi },
      mcp: mockMcpService,
      apiClient: mockApiClient,
    }
  });
  
  // Wait for services to be ready
  await container.waitForReady('auth', 'config', 'model', 'mcp', 'apiClient');
  
  const frame = lastFrame();
  expect(frame).toContain("Ask anything");
  expect(frame).toContain("│");
});
```

### 3.2 Test Loading States
```typescript
it("shows loading state while services initialize", async () => {
  const { lastFrame, container } = renderWithServices(<TUIChat />);
  
  // Should show loading initially
  expect(lastFrame()).toContain("Loading services...");
  
  // Resolve services one by one
  await act(async () => {
    container.resolveService('auth', { isAuthenticated: true });
    await container.waitForReady('auth');
  });
  
  expect(lastFrame()).toContain("✓ Authentication ready");
  
  // Resolve remaining services
  await act(async () => {
    container.resolveService('config', { config: mockConfig });
    container.resolveService('model', { model: mockModel });
    // ... etc
    await container.waitForReady('config', 'model', 'mcp', 'apiClient');
  });
  
  // Should now show chat UI
  expect(lastFrame()).toContain("Ask anything");
});
```

## Phase 4: Remove Remote Mode Tests

### 4.1 Delete remote mode workarounds
- Remove `remoteUrl` prop from all tests
- Update test assertions to match local mode behavior
- Remove remote mode specific expectations

### 4.2 Update test checklist
- Mark all tests as using local mode
- Document any tests that still need remote mode (e.g., actual remote server tests)

## Implementation Order

1. **Week 1: Foundation**
   - [ ] Create ServiceContainerContext and Provider
   - [ ] Update useService/useServices hooks
   - [ ] Create test utilities (TestServiceContainer, renderWithServices)
   - [ ] Test the new utilities with one simple test file

2. **Week 2: Migration**
   - [ ] Migrate TUIChat.messages.test.tsx
   - [ ] Migrate TUIChat.input.test.tsx
   - [ ] Migrate TUIChat.fileSearch.test.tsx
   - [ ] Migrate TUIChat.slashCommands.test.tsx

3. **Week 3: Completion**
   - [ ] Migrate TUIChat.remote.test.tsx (keep some remote tests)
   - [ ] Migrate TUIChat.toolDisplay.test.tsx
   - [ ] Re-enable TUIChat.advanced.test.tsx
   - [ ] Update documentation

## Success Criteria

1. **All tests pass** without using remote mode (except actual remote tests)
2. **No flaky tests** - async operations are controlled
3. **Better coverage** - can test loading states, errors, and state transitions
4. **Faster tests** - no real network calls or uncontrolled timers
5. **Maintainable** - clear patterns for adding new tests

## Risks and Mitigations

### Risk 1: Breaking Production Code
**Mitigation**: Changes are mostly additive (adding Context), keeping existing behavior

### Risk 2: Test Complexity
**Mitigation**: Good test utilities and examples make writing tests easier

### Risk 3: Missing Edge Cases
**Mitigation**: Keep some integration tests that use real services

## Long Term Benefits

1. **Confidence in tests** - they match production behavior
2. **Easier debugging** - can control service states
3. **Better test coverage** - can test error states and edge cases
4. **Faster development** - no more "mock hell"
5. **Scalable** - easy to add new services and tests