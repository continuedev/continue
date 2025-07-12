---
alwaysApply: false
---

# Continue Development Data (Dev Data) Guide

## Overview

Development data (dev data) captures detailed information about how developers interact with LLM-aided development tools. Unlike basic telemetry, dev data includes lots of details into the complete software development workflow, including code context, user interactions, and development patterns.

## Core Architecture

### Primary Implementation Files

- **`/core/data/log.ts`**: Main `DataLogger` class - singleton for event logging and remote transmission
- **`/packages/config-yaml/src/schemas/data/`**: Schema definitions for all event types

### Storage Locations

- **Default storage**: `~/.continue/dev_data/`
- **Event files**: `~/.continue/dev_data/{version}/{eventName}.jsonl`

## Event Types and Schemas

### Core Event Types

1. **`tokensGenerated`**: LLM token usage tracking
2. **`autocomplete`**: Code completion interactions
3. **`chatInteraction`**: Chat-based development assistance
4. **`editInteraction`**: Code editing sessions
5. **`editOutcome`**: Results of edit operations
6. **`nextEditOutcome`**: Next Edit feature outcomes
7. **`chatFeedback`**: User feedback on AI responses
8. **`toolUsage`**: Tool interaction statistics
9. **`quickEdit`**: Quick edit functionality usage

### Schema Versioning

- **Version 0.1.0**: Initial schema implementation
- **Version 0.2.0**: Current schema with expanded fields and metadata
- **Schema files**: Located in `/packages/config-yaml/src/schemas/data/`

### Base Schema Structure

All events inherit from a base schema (`/packages/config-yaml/src/schemas/data/base.ts`):

```typescript
{
  eventName: string,
  schema: string,
  timestamp: string,
  userId: string,
  userAgent: string,
  selectedProfileId: string
}
```

## Key Integration Points

### Autocomplete System

- **File**: `/core/autocomplete/util/AutocompleteLoggingService.ts`
- **Purpose**: Tracks code completion acceptance/rejection, timing, and cache hits
- **Integration**: Called from autocomplete engine when completions are shown/accepted

### Chat Interface

- **Integration**: Chat interactions logged through `DataLogger.logDevData()`
- **Data**: Includes prompts, responses, context, and user feedback
- **Privacy**: Can be configured to exclude code content

### Edit Features

- **Files**: `/extensions/vscode/src/extension/EditOutcomeTracker.ts`, `/core/nextEdit/NextEditLoggingService.ts`
- **Purpose**: Track edit suggestions, acceptance rates, and outcomes
- **Integration**: Embedded in edit workflow to capture user decisions

### LLM Token Tracking

- **File**: `/core/llm/index.ts`
- **Purpose**: Track token usage across all LLM providers
- **Storage**: SQLite database for efficient querying and reporting

## Configuration and Customization

### Configuration Structure

Dev data is configured through `data` blocks in your Continue config:

```yaml
data:
  - name: "Local Development Data"
    destination: "file:///Users/developer/.continue/dev_data"
    schema: "0.2.0"
    level: "all"
    events: ["autocomplete", "chatInteraction", "editOutcome"]

  - name: "Team Analytics"
    destination: "https://analytics.yourcompany.com/api/events"
    schema: "0.2.0"
    level: "noCode"
    apiKey: "your-api-key-here"
    events: ["tokensGenerated", "toolUsage"]
```

### Configuration Options

- **`destination`**: Where to send data (`file://` for local, `http://`/`https://` for remote)
- **`schema`**: Schema version to use (`"0.1.0"` or `"0.2.0"`)
- **`level`**: Data detail level (`"all"` includes code, `"noCode"` excludes code content)
- **`events`**: Array of event types to collect
- **`apiKey`**: Authentication for remote endpoints

### Privacy Controls

- **`"all"` level**: Includes code content (prefixes, suffixes, completions)
- **`"noCode"` level**: Excludes code content, only metadata and metrics
- **Local-first**: Data is always stored locally, remote transmission is optional

## Making Changes to Dev Data

### Adding New Event Types

1. **Create schema**: Add new event schema in `/packages/config-yaml/src/schemas/data/`
2. **Update index**: Add to schema aggregator in `/packages/config-yaml/src/schemas/data/index.ts`
3. **Implement logging**: Add logging calls in relevant service files
4. **Update version**: Consider schema version bump if breaking changes

### Modifying Existing Events

1. **Schema changes**: Update schema files in `/packages/config-yaml/src/schemas/data/`
2. **Backward compatibility**: Ensure changes don't break existing data consumers
3. **Version management**: Increment schema version for breaking changes
4. **Test thoroughly**: Validate schema changes with existing data

### Adding New Logging Points

1. **Import DataLogger**: `import { DataLogger } from "core/data/log"`
2. **Log events**: Call `DataLogger.getInstance().logDevData(eventName, data)`
3. **Follow patterns**: Use existing logging services as examples
4. **Validate data**: Ensure logged data matches schema requirements

### Debugging Dev Data Issues

1. **Check local storage**: Verify files are being created in `~/.continue/dev_data/`
2. **Validate schemas**: Ensure event data matches expected schema format
3. **Review configuration**: Check `data` blocks in Continue config
4. **Test endpoints**: Verify remote endpoints are reachable and accepting data

## Best Practices

### When Adding New Events

- Follow existing naming conventions for event types
- Include sufficient context for analysis without oversharing sensitive data
- Consider privacy implications and respect user configuration levels
- Add appropriate error handling and logging

### When Modifying Schemas

- Maintain backward compatibility when possible
- Document schema changes thoroughly
- Consider impact on existing data consumers
- Test with real development data

### When Integrating Logging

- Use the singleton pattern: `DataLogger.getInstance()`
- Log events at appropriate points in user workflow
- Respect user privacy settings and configuration
- Handle errors gracefully without disrupting user experience

## Common Patterns

### Service-Based Logging

Most dev data logging follows a service pattern:

```typescript
export class FeatureLoggingService {
  private dataLogger = DataLogger.getInstance();

  logFeatureUsage(data: FeatureUsageData) {
    this.dataLogger.logDevData("featureUsage", data);
  }
}
```

### Event-Driven Logging

Events are typically logged at key interaction points:

```typescript
// When user accepts autocomplete
onAutocompleteAccepted(completion: CompletionData) {
  AutocompleteLoggingService.getInstance().logAutocompleteAccepted(completion);
}
```

This guide provides the foundation for understanding and working with Continue's dev data system. Always prioritize user privacy and follow established patterns when making changes.
