# Event Tool for Activity Timeline

## Overview

The Event tool enables Continue agents to report significant actions and milestones to the task's activity timeline in Continue Mission Control. This provides visibility into agent progress and helps users track what their agents have accomplished during execution.

## What is the Event Tool?

The Event tool allows agents to post activity events that appear in the task timeline. These events help users:

- **Track Progress**: See what the agent has accomplished in real-time
- **Review Actions**: Understand the sequence of operations performed
- **Access Resources**: Get direct links to created PRs, comments, or other external resources
- **Debug Issues**: Identify where problems occurred during execution

## Usage

### Prerequisites

The Event tool is only available when running in **agent mode** with the `--id` flag:

```bash
cn serve --id <agentSessionId>
```

The agent must also be authenticated with Continue Mission Control.

### Tool Parameters

The Event tool accepts the following parameters:

| Parameter     | Type   | Required | Description                                                                  |
| ------------- | ------ | -------- | ---------------------------------------------------------------------------- |
| `eventName`   | string | Yes      | A short identifier for the event type (e.g., "pr_created", "comment_posted") |
| `title`       | string | Yes      | A human-readable summary of what happened                                    |
| `description` | string | No       | Additional details about the event                                           |
| `externalUrl` | string | No       | A link to the relevant resource (e.g., GitHub PR URL)                        |

### Supported Event Types

While you can use any custom event name, these standard types are recognized:

- `pr_created` - A pull request was created
- `comment_posted` - A comment was posted on an issue or PR
- `commit_pushed` - Commits were pushed to a repository
- `issue_closed` - An issue was closed
- `review_submitted` - A code review was submitted

### Example Usage

The agent automatically calls this tool when configured to do so. Here are examples of how events might be reported:

#### Creating a Pull Request

```json
{
  "name": "Event",
  "parameters": {
    "eventName": "pr_created",
    "title": "Created PR #123: Fix authentication bug",
    "description": "Implemented JWT token validation and added error handling for expired tokens",
    "externalUrl": "https://github.com/org/repo/pull/123"
  }
}
```

#### Posting a Comment

```json
{
  "name": "Event",
  "parameters": {
    "eventName": "comment_posted",
    "title": "Posted analysis comment on PR #45",
    "description": "Identified potential security vulnerability in authentication middleware",
    "externalUrl": "https://github.com/org/repo/pull/45#issuecomment-123456"
  }
}
```

#### Pushing Commits

```json
{
  "name": "Event",
  "parameters": {
    "eventName": "commit_pushed",
    "title": "Pushed 3 commits implementing user authentication",
    "description": "Added login, registration, and password reset functionality"
  }
}
```

## Viewing Events

Events posted by the Event tool appear in the **Activity Timeline** on the task detail page in Continue Mission Control. Each event shows:

- The event title and description
- Timestamp of when the event occurred
- Link to external resources (if provided)
- Event type indicator

## Architecture

### Event Flow

1. The agent calls the Event tool with event parameters
2. The CLI extracts the agent session ID from the `--id` flag
3. The event is sent to the Continue control plane via the API
4. The control plane stores the event and associates it with the task
5. The event appears in the task's activity timeline

### API Endpoint

Events are posted to the control plane endpoint:

```http
POST /agents/{agentSessionId}/events
Authorization: Bearer <CONTINUE_API_KEY>
Content-Type: application/json

{
  "eventName": "pr_created",
  "title": "Created PR #123: Fix authentication bug",
  "description": "Implemented JWT token validation...",
  "externalUrl": "https://github.com/org/repo/pull/123"
}
```

### Error Handling

The Event tool is designed to be **non-blocking**. If event posting fails:

- The agent continues execution without interruption
- A warning is logged but no error is thrown
- The tool returns an acknowledgment message

This ensures that connectivity issues or API problems don't disrupt the agent's primary task.

## Best Practices

### When to Use Events

Post events for **significant milestones** that users care about:

✅ **Do post events for:**

- Creating or updating external resources (PRs, issues, comments)
- Completing major workflow steps
- Important decisions or analysis results
- Actions that affect external systems

❌ **Avoid posting events for:**

- Internal file operations (reading, writing local files)
- Routine data processing steps
- Every function call or tool use
- Debugging information

### Writing Good Event Titles

Event titles should be:

- **Concise**: One line summarizing the action
- **Action-oriented**: Start with a verb ("Created", "Posted", "Fixed")
- **Specific**: Include relevant identifiers (PR numbers, file names)
- **User-focused**: Written for humans, not machines

**Good examples:**

- "Created PR #123: Fix authentication bug"
- "Posted security analysis on issue #456"
- "Pushed 3 commits implementing user profiles"

**Poor examples:**

- "Done" (too vague)
- "pr_created_for_bug_fix_in_auth_module" (too technical)
- "Step 5 complete" (lacks context)

### Using External URLs

Always include `externalUrl` when the event relates to an external resource:

- Link to the specific PR, issue, or comment (not just the repo)
- Use permanent links that won't break over time
- Include comment anchors for direct navigation

## Environment Variables

The Event tool requires these environment variables (automatically provided in agent mode):

- `CONTINUE_API_KEY`: Bearer token for backend authentication
- `CONTINUE_API_BASE`: API base URL (defaults to `https://api.continue.dev/`)

## Security Considerations

1. **Authentication**: All event posts require valid API keys
2. **Authorization**: The agent session ID must match the authenticated user/org
3. **Rate Limiting**: Events are subject to API rate limits
4. **Data Validation**: Event parameters are validated before posting
5. **Privacy**: Avoid including sensitive data in event titles or descriptions

## Comparison with Other Tools

### Event vs. UploadArtifact

| Feature     | Event Tool                 | UploadArtifact Tool                    |
| ----------- | -------------------------- | -------------------------------------- |
| Purpose     | Report activity milestones | Upload files for review                |
| Data Type   | Text metadata              | Binary files (screenshots, videos)     |
| Size Limits | Small JSON payloads        | Up to 50MB per file                    |
| Visibility  | Activity timeline          | Artifacts section                      |
| Beta Flag   | Not required               | Requires `--beta-upload-artifact-tool` |

### Event vs. ReportFailure

| Feature   | Event Tool                | ReportFailure Tool              |
| --------- | ------------------------- | ------------------------------- |
| Purpose   | Report successful actions | Report fatal errors             |
| Outcome   | Agent continues           | Agent terminates                |
| Usage     | Optional, for visibility  | Used when agent cannot continue |
| Frequency | Multiple per task         | Once per task (terminal)        |

## Future Enhancements

Potential improvements to the Event tool:

- **Event Types**: Standardized event schemas for common operations
- **Event Metadata**: Structured data fields for filtering and analysis
- **Event Attachments**: Link events to specific artifacts or diffs
- **Event Notifications**: Real-time notifications for critical events
- **Event Analytics**: Aggregate views across multiple tasks

---

This document describes the Event tool as of its initial implementation. Update it as the tool evolves.
