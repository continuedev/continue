# Sentry Integration for Continue Core

This document explains how to use the Sentry integration in the Continue Core project for error tracking, performance monitoring, and structured logging.

## Setup and Configuration

1. Add the Sentry DSN to your environment variables:
   ```
   SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
   ```

2. Import and initialize Sentry in your application entry point:

   ```typescript
   import { initSentry } from "./util/sentry";
   
   // Initialize at application startup
   const { Sentry, logger } = initSentry();
   ```

## Error Tracking

Use Sentry to capture exceptions throughout your codebase:

```typescript
import { captureException } from "./util/sentry";

try {
  // Your code that might throw an error
} catch (error) {
  captureException(error, { 
    additionalContext: "value",
    userId: user.id 
  });
}
```

Alternatively, use the `withErrorTracking` utility to wrap functions:

```typescript
import { withErrorTracking } from "./util/sentry";

const riskyFunction = withErrorTracking(function() {
  // Code that might throw errors
}, { functionName: "riskyFunction" });
```

## Performance Monitoring

Track performance of important operations using spans:

```typescript
import { createSpan } from "./util/sentry";

async function fetchUserData(userId: string) {
  return createSpan(
    "http.client",
    `GET /api/users/${userId}`,
    async () => {
      const response = await fetch(`/api/users/${userId}`);
      const data = await response.json();
      return data;
    }
  );
}
```

## Structured Logging

Use the Sentry logger for structured logging:

```typescript
import { initSentry } from "./util/sentry";

const { logger } = initSentry();

// Different log levels
logger.trace("Starting database connection", { database: "users" });
logger.debug(logger.fmt`Cache miss for user: ${userId}`);
logger.info("Updated profile", { profileId: 345 });
logger.warn("Rate limit reached for endpoint", { endpoint: "/api/results/" });
logger.error("Failed to process payment", { orderId: "order_123" });
logger.fatal("Database connection pool exhausted", { activeConnections: 100 });
```

## Integration Examples

### In Core.ts

```typescript
import { initSentry, captureException, createSpan } from "./util/sentry";

// Initialize at core startup
const { Sentry, logger } = initSentry();

// In message handlers
on("llm/streamChat", (msg) => {
  return createSpan(
    "llm.chat",
    "Stream Chat",
    () => llmStreamChat(this.configHandler, abortController, msg, this.ide, this.messenger)
  );
});

// For error handling in API calls
try {
  const result = await someOperation();
  return result;
} catch (error) {
  captureException(error, { messageType: "operation_name" });
  throw error;
}
```

### In Command Handlers

```typescript
import { captureException, createSpan } from "../util/sentry";

export async function handleCommand(args) {
  return createSpan(
    "command.execution",
    `Command: ${args.command}`,
    async () => {
      try {
        // Command implementation
      } catch (error) {
        captureException(error, { command: args.command });
        throw error;
      }
    }
  );
}
```