# Sentry Integration

This document explains how to configure and use Sentry for error monitoring and performance tracking in the Continue CLI.

## Setup

### Environment Variables

To enable Sentry, set the following environment variables:

```bash
# Required: Sentry DSN (Data Source Name)
export SENTRY_DSN="https://your-dsn@sentry.io/project-id"

# Optional: Environment name (defaults to NODE_ENV or "development")
export SENTRY_ENVIRONMENT="production"

# Optional: Sample rates (defaults to 1.0 for all)
export SENTRY_SAMPLE_RATE="1.0"                    # Error sampling rate
export SENTRY_PROFILES_SAMPLE_RATE="1.0"           # Performance profiling rate
export SENTRY_TRACES_SAMPLE_RATE="1.0"             # Performance tracing rate
```

### Disabling Sentry

To completely disable Sentry, you can:

1. **Not set `SENTRY_DSN`** - Sentry will be disabled automatically
2. **Explicitly disable**: `export SENTRY_ENABLED="false"`

## What Gets Monitored

### Automatic Error Capture

- **Unhandled Promise Rejections**: Global promise rejections are captured
- **Uncaught Exceptions**: Global uncaught exceptions are captured
- **Logger Errors**: All `logger.error()` and `logger.warn()` calls are sent to Sentry
- **Command Errors**: Errors in chat commands and other CLI operations

### Performance Monitoring

- **Profiling**: CPU and memory profiling data (when enabled)
- **Performance Traces**: Request timing and performance metrics

### Context Information

Sentry automatically includes:
- Application version
- Environment (development/production)
- Node.js version and platform
- Error stack traces
- Custom context for each error (when available)

## Usage in Code

The Sentry service is automatically initialized and available throughout the application. You can use it directly:

```typescript
import sentryService from "./sentry.js";

// Capture an exception with context
try {
  // some code
} catch (error) {
  sentryService.captureException(error, {
    context: "my_operation",
    userId: "12345",
  });
}

// Capture a message
sentryService.captureMessage("Something important happened", "info", {
  customData: "value"
});

// Set user context
sentryService.setUser({
  id: "user123",
  email: "user@example.com"
});

// Add breadcrumbs for debugging
sentryService.addBreadcrumb({
  message: "User performed action",
  category: "user",
  level: "info",
  data: { action: "click_button" }
});
```

## Testing the Integration

### Test Error Capture

```bash
# Set up Sentry (replace with your actual DSN)
export SENTRY_DSN="https://your-dsn@sentry.io/project-id"

# Run the CLI and trigger an error to test
cn "this should work normally"
```

### Test Disabled State

```bash
# Disable Sentry
export SENTRY_ENABLED="false"
# or simply don't set SENTRY_DSN

# Run the CLI - no Sentry data should be sent
cn "this will run without Sentry"
```

### Verify Configuration

The application logs will show when Sentry is initialized:

```
DEBUG: Sentry initialized { environment: 'development', release: '0.0.0-dev' }
```

If Sentry is disabled, you won't see this log message.

## Privacy and Security

- Sentry only captures error information and performance metrics
- No user prompts or sensitive data are sent to Sentry by default
- All data transmission is encrypted (HTTPS)
- You control what environment and sampling rates to use

## Troubleshooting

### Sentry Not Working

1. **Check DSN**: Ensure `SENTRY_DSN` is set correctly
2. **Check Network**: Ensure your environment can reach sentry.io
3. **Check Logs**: Look for Sentry initialization messages in debug logs
4. **Check Sampling**: Ensure sample rates are > 0

### Too Much Data

1. **Reduce Sample Rates**: Lower `SENTRY_SAMPLE_RATE`, `SENTRY_PROFILES_SAMPLE_RATE`, or `SENTRY_TRACES_SAMPLE_RATE`
2. **Use Environment Filtering**: Set different configurations for dev vs prod

### No Data in Sentry Dashboard

1. **Check Project Settings**: Ensure the DSN matches your Sentry project
2. **Check Filters**: Verify no filters are blocking your data
3. **Wait**: It can take a few minutes for data to appear in Sentry