# OTLP Metrics Specification for Continue CLI

This document specifies the OpenTelemetry Protocol (OTLP) metrics that should be emitted by the Continue CLI to provide comprehensive observability and usage monitoring. The metrics are designed to be compatible with Claude Code dashboards for easy migration.

## Overview

The Continue CLI should emit metrics that provide insights into:

- Usage patterns and session analytics
- Performance and reliability
- Tool usage and effectiveness
- Error rates and types
- Resource utilization
- Code modification tracking

## Configuration

### Environment Variables

| Environment Variable            | Description                                                     | Example Values                       |
| ------------------------------- | --------------------------------------------------------------- | ------------------------------------ |
| `CONTINUE_METRICS_ENABLED`      | Enables OTEL telemetry collection (preferred, takes precedence) | `0` to disable, `1` to enable        |
| `CONTINUE_CLI_ENABLE_TELEMETRY` | Enables OTEL telemetry collection (legacy, lower precedence)    | `0` to disable, `1` to enable        |
| `OTEL_METRICS_EXPORTER`         | Metrics exporter type(s) (comma-separated)                      | `console`, `otlp`, `prometheus`      |
| `OTEL_LOGS_EXPORTER`            | Logs/events exporter type(s) (comma-separated)                  | `console`, `otlp`                    |
| `OTEL_EXPORTER_OTLP_PROTOCOL`   | Protocol for OTLP exporter (all signals)                        | `grpc`, `http/json`, `http/protobuf` |
| `OTEL_EXPORTER_OTLP_ENDPOINT`   | OTLP collector endpoint (all signals)                           | `http://localhost:4317`              |
| `OTEL_EXPORTER_OTLP_HEADERS`    | Authentication headers for OTLP                                 | `Authorization=Bearer token`         |
| `OTEL_METRIC_EXPORT_INTERVAL`   | Export interval in milliseconds (default: 60000)                | `5000`, `60000`                      |
| `OTEL_LOGS_EXPORT_INTERVAL`     | Logs export interval in milliseconds (default: 5000)            | `1000`, `10000`                      |
| `OTEL_LOG_USER_PROMPTS`         | Enable logging of user prompt content (default: disabled)       | `1` to enable                        |

### Metrics Cardinality Control

| Environment Variable                | Description                                    | Default Value | Example to Disable |
| ----------------------------------- | ---------------------------------------------- | ------------- | ------------------ |
| `OTEL_METRICS_INCLUDE_SESSION_ID`   | Include session.id attribute in metrics        | `true`        | `false`            |
| `OTEL_METRICS_INCLUDE_VERSION`      | Include app.version attribute in metrics       | `false`       | `true`             |
| `OTEL_METRICS_INCLUDE_ACCOUNT_UUID` | Include user.account_uuid attribute in metrics | `true`        | `false`            |

## Standard Attributes

All metrics and events share these standard attributes:

| Attribute           | Description                                                   | Controlled By                                       |
| ------------------- | ------------------------------------------------------------- | --------------------------------------------------- |
| `session.id`        | Unique session identifier                                     | `OTEL_METRICS_INCLUDE_SESSION_ID` (default: true)   |
| `app.version`       | Current Continue CLI version                                  | `OTEL_METRICS_INCLUDE_VERSION` (default: false)     |
| `organization.id`   | Organization UUID (when authenticated)                        | Always included when available                      |
| `user.account_uuid` | Account UUID (when authenticated)                             | `OTEL_METRICS_INCLUDE_ACCOUNT_UUID` (default: true) |
| `terminal.type`     | Terminal type (e.g., `iTerm.app`, `vscode`, `cursor`, `tmux`) | Always included when detected                       |

## Core Metrics

### ✅ `continue_cli_session_count`

**Type:** Counter  
**Unit:** `count`  
**Description:** Count of CLI sessions started

**Attributes:**

- All [standard attributes](#standard-attributes)

**Implementation:** Track in `src/commands/chat.ts` when session starts

---

### ✅ `continue_cli_lines_of_code_count`

**Type:** Counter  
**Unit:** `count`  
**Description:** Count of lines of code modified

**Attributes:**

- All [standard attributes](#standard-attributes)
- `type`: (`"added"`, `"removed"`)

**Implementation:** Track in `src/tools/writeFile.ts` by analyzing file diffs

---

### ✅ `continue_cli_pull_request_count`

**Type:** Counter  
**Unit:** `count`  
**Description:** Number of pull requests created

**Attributes:**

- All [standard attributes](#standard-attributes)

**Implementation:** Track when `runTerminalCommand` executes git/gh commands for PR creation

---

### ✅ `continue_cli_commit_count`

**Type:** Counter  
**Unit:** `count`  
**Description:** Number of git commits created

**Attributes:**

- All [standard attributes](#standard-attributes)

**Implementation:** Track when `runTerminalCommand` executes `git commit` commands

---

### ✅ `continue_cli_cost_usage`

**Type:** Counter  
**Unit:** `USD`  
**Description:** Cost of the Continue CLI session

**Attributes:**

- All [standard attributes](#standard-attributes)
- `model`: Model identifier (e.g., "claude-3-5-sonnet-20241022", "gpt-4")

**Implementation:** Calculate costs based on token usage and model pricing in `src/streamChatResponse.ts`

---

### ✅ `continue_cli_token_usage`

**Type:** Counter  
**Unit:** `tokens`  
**Description:** Number of tokens used

**Attributes:**

- All [standard attributes](#standard-attributes)
- `type`: (`"input"`, `"output"`, `"cacheRead"`, `"cacheCreation"`)
- `model`: Model identifier (e.g., "claude-3-5-sonnet-20241022", "gpt-4")

**Implementation:** Track in `src/streamChatResponse.ts` after each API response

---

### ❌ `continue_cli_code_edit_tool_decision`

**Type:** Counter  
**Unit:** `count`  
**Description:** Count of code editing tool permission decisions

**Attributes:**

- All [standard attributes](#standard-attributes)
- `tool`: Tool name (`"writeFile"`, `"runTerminalCommand"`, etc.)
- `decision`: User decision (`"accept"`, `"reject"`)
- `language`: Programming language of the edited file (e.g., `"TypeScript"`, `"Python"`, `"JavaScript"`, `"Markdown"`). Returns `"unknown"` for unrecognized file extensions.

**Implementation:** Track in tool execution when user confirmation is required (if implemented)

---

### ✅ `continue_cli_active_time_total`

**Type:** Counter  
**Unit:** `s`  
**Description:** Total active time in seconds

**Attributes:**

- All [standard attributes](#standard-attributes)

**Implementation:** Track in TUI mode (`src/ui/TUIChat.tsx`) and standard chat mode, measuring time during active interactions

## Core Events

### ✅ User Prompt Event

**Event Name:** `continue_cli_user_prompt`

**Attributes:**

- All [standard attributes](#standard-attributes)
- `event.name`: `"user_prompt"`
- `event.timestamp`: ISO 8601 timestamp
- `prompt_length`: Length of the prompt
- `prompt`: Prompt content (redacted by default, enable with `OTEL_LOG_USER_PROMPTS=1`)

**Implementation:** Log in `src/streamChatResponse.ts` when user message is added to chat history

---

### ✅ Tool Result Event

**Event Name:** `continue_cli_tool_result`

**Attributes:**

- All [standard attributes](#standard-attributes)
- `event.name`: `"tool_result"`
- `event.timestamp`: ISO 8601 timestamp
- `tool_name`: Name of the tool
- `success`: `"true"` or `"false"`
- `duration_ms`: Execution time in milliseconds
- `error`: Error message (if failed)
- `decision`: Either `"accept"` or `"reject"` (if applicable)
- `source`: Decision source - `"config"`, `"user_permanent"`, `"user_temporary"`, `"user_abort"`, or `"user_reject"` (if applicable)
- `tool_parameters`: JSON string containing tool-specific parameters (when available)

**Implementation:** Log in `src/tools/index.ts` `executeToolCall` function

---

### ✅ API Request Event

**Event Name:** `continue_cli_api_request`

**Attributes:**

- All [standard attributes](#standard-attributes)
- `event.name`: `"api_request"`
- `event.timestamp`: ISO 8601 timestamp
- `model`: Model identifier
- `duration_ms`: Request duration in milliseconds
- `success`: `"true"` or `"false"`
- `error`: Error message (if failed)
- `input_tokens`: Number of input tokens
- `output_tokens`: Number of output tokens
- `cost_usd`: Request cost in USD

**Implementation:** Log in `src/streamChatResponse.ts` for each API request

## Additional Metrics

These metrics are unique to Continue CLI and provide additional insights without conflicting with compatibility:

### Authentication Metrics

#### ✅ `continue_cli_auth_attempts`

**Type:** Counter  
**Unit:** `{attempt}`  
**Description:** Authentication attempts

**Labels:**

- All [standard attributes](#standard-attributes)
- `result`: `success` | `failure` | `cancelled`
- `method`: `workos` | `token`

**Implementation:** Track in `src/auth/workos.ts`

### MCP Integration Metrics

#### ❌ `continue_cli_mcp_connections`

**Type:** Gauge  
**Unit:** `{connection}`  
**Description:** Active MCP connections

**Labels:**

- All [standard attributes](#standard-attributes)
- `server_name`: MCP server identifier
- `status`: `connected` | `disconnected` | `error`

**Implementation:** Track in `src/mcp.ts`

### Performance Metrics

#### ❌ `continue_cli_startup_time`

**Type:** Histogram  
**Unit:** `ms`  
**Description:** Time from CLI start to ready state

**Labels:**

- All [standard attributes](#standard-attributes)
- `mode`: `tui` | `headless` | `standard`
- `cold_start`: `true` | `false`

**Implementation:** Track in `src/index.ts` and `src/commands/chat.ts`

#### ✅ `continue_cli_response_time`

**Type:** Histogram  
**Unit:** `ms`  
**Description:** LLM response time metrics (supplements API request events)

**Labels:**

- All [standard attributes](#standard-attributes)
- `model`: Model identifier
- `metric_type`: `time_to_first_token` | `total_response_time`
- `has_tools`: `true` | `false`

**Implementation:** Track in `src/streamChatResponse.ts`

## Implementation Guidelines

### Migration from Claude Code Dashboards

The core metrics (`session_count`, `lines_of_code_count`, `token_usage`, `cost_usage`, etc.) use identical naming and attribute structures to Claude Code, allowing for easy dashboard migration by simply changing the metric prefix from `claude_code_*` to `continue_cli_*`.

### Privacy Considerations

- **No PII**: Avoid logging file paths, user content, or other personally identifiable information
- **Redacted by Default**: User prompts are redacted unless `OTEL_LOG_USER_PROMPTS=1`
- **Configurable Attributes**: Use cardinality control variables to manage data granularity
- **Opt-out**: Provide mechanism to disable telemetry entirely

### Resource Attributes

All metrics should include these resource attributes:

- `service.name`: `continue-cli`
- `service.version`: CLI version
- `deployment.environment`: `development` | `production`
- `os.type`: Operating system
- `process.pid`: Process ID

### Implementation Points

1. **Session Tracking**: Initialize session ID and track lifecycle in `src/commands/chat.ts`
2. **Token/Cost Tracking**: Implement in `src/streamChatResponse.ts` with model-specific pricing
3. **Tool Usage**: Track in `src/tools/index.ts` and individual tool implementations
4. **File Operations**: Implement diff analysis in `src/tools/writeFile.ts` for LOC tracking
5. **Command Detection**: Parse git/gh commands in `src/tools/runTerminalCommand.ts`
6. **Authentication**: Track auth flows in `src/auth/workos.ts`
7. **Performance**: Add timing measurements throughout the application lifecycle

## Implementation Status

✅ = Implemented  
❌ = Not implemented yet

**Core metrics:** 6/7 implemented (83%)
**Core events:** 3/3 implemented (100%)  
**Additional metrics:** 4/7 implemented (57%)

**Missing implementations:**

- `continue_cli_code_edit_tool_decision` - requires user confirmation UI
- `continue_cli_mcp_connections` - needs MCP service monitoring
- `continue_cli_startup_time` - needs startup time tracking
