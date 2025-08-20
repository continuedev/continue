# Continue Agent Usage Examples

## Basic Usage

### 1. Automatic Review on PR
When a PR is opened or marked ready for review, the Continue Agent will automatically perform a code review.

### 2. Manual Trigger with @mention
Comment on any PR with:
```
@continue-agent
```

### 3. Request Detailed Review
```
@continue-agent detailed
```

### 4. Custom Review Focus
You can provide specific instructions after the @mention:

```
@continue-agent please focus on security implications and performance
```

```
@continue-agent check if this follows our team's React best practices
```

```
@continue-agent detailed review the error handling and edge cases
```

## Security Features

1. **Workflow-level filtering**: The workflow only runs when:
   - It's a PR event (opened, synchronized, ready_for_review)
   - It's a comment on a PR that contains `@continue-agent`

2. **Action-level authorization**: Only authorized users (OWNER, MEMBER, COLLABORATOR) can trigger reviews

3. **Input sanitization**: Custom prompts are:
   - Read as data, not executed as code
   - Written to temporary files to prevent injection
   - Passed through environment variables safely

## How Custom Prompts Work

When you comment `@continue-agent [your custom instructions]`, the action:
1. Extracts the text after `@continue-agent`
2. Sanitizes it by treating it as data (no shell execution)
3. Passes it to the review action as additional context
4. The AI incorporates your instructions into its review

This allows flexible, context-aware reviews while maintaining security.