# Subagents

## Overview

The Subagent tool enables Continue CLI agents to spawn specialized sub-agents to handle complex, multi-step tasks autonomously. This allows for better task parallelization and separation of concerns by delegating specific work to isolated agent sessions.

## Architecture

### Subagent Execution

Subagents run in isolated child sessions with the following characteristics:

- **Isolated System Message**: Each subagent gets its own system prompt combined with the agent-specific instructions
- **Separate Chat History**: Subagents maintain their own conversation context, independent of the parent agent
- **Tool Access**: Subagents have access to all standard tools (Read, Write, Edit, etc.) except the Subagent tool itself to prevent recursion
- **Permission Inheritance**: Subagents inherit tool permissions from the main agent, with all tools currently allowed by default

### Tool Interface

The Subagent tool is a built-in tool available to all agents running in the CLI.

**Tool Name:** `Subagent`

**Parameters:**

- `description` (string, required): A short 3-5 word description of the task
- `prompt` (string, required): The detailed task for the subagent to perform
- `subagent_name` (string, required): The type of specialized agent to use (currently only `"general"` is available)

**Example Tool Call:**

```json
{
  "name": "Subagent",
  "parameters": {
    "description": "Research API patterns",
    "prompt": "Analyze the codebase and document all REST API endpoints, including their parameters, response formats, and authentication requirements.",
    "subagent_name": "general"
  }
}
```

## Built-in Agents

### General Agent

The `general` agent is a versatile subagent designed for autonomous execution of multi-step tasks.

**Capabilities:**

- Researching complex questions across multiple files
- Executing multi-step implementation tasks
- Performing comprehensive code analysis
- Working autonomously with minimal guidance

**System Prompt:**

```
You are a specialized task execution agent.

Your role:
- Work autonomously to complete the given task
- Use available tools effectively
- Provide clear, concise results
- If you cannot complete the task, explain why clearly

Important:
- Focus on the specific task at hand
- Avoid unnecessary explanations or preamble in your final response
- Return actionable results
```

## When to Use Subagents

**Good Use Cases:**

- Complex research tasks requiring multiple file reads and searches
- Multi-step implementation tasks that can be completed independently
- Tasks that benefit from autonomous execution without back-and-forth
- Parallelizing independent work items

**Not Recommended For:**

- Simple single-file reads (use the `Read` tool directly)
- Single search operations (use the `searchCode` tool directly)
- Tasks that require frequent user input or clarification
- Trivial operations that don't require multiple steps

## Output Streaming

Subagent execution supports real-time output streaming:

- The subagent's output is streamed back to the parent agent as it executes
- Long outputs are truncated in the UI (showing the last 20 lines)
- Tool calls and their results are visible during execution
- A metadata footer indicates the task status (completed/failed)

**UI Output Format:**

```
⎿ Subagent output:
... +50 lines
<last 20 lines of output>

<task_metadata>
status: completed
</task_metadata>
```

## Implementation Details

### Tool Changes

The introduction of subagents required a modification to the `Tool` interface:

**Before:**

```typescript
run: (args: any) => Promise<string>;
```

**After:**

```typescript
run: (args: any, context?: { toolCallId: string }) => Promise<string>;
```

The optional `context` parameter provides the `toolCallId` which enables live streaming of subagent output back to the parent agent's chat history.

**Migration Note:** If you have custom tools with strict TypeScript settings, update their signatures to match the new interface. The `context` parameter is optional and can be ignored if streaming is not needed.

## Execution Flow

1. **Tool Call**: Parent agent calls the Subagent tool with description, prompt, and agent type
2. **Validation**: The system validates the agent type and checks for available models
3. **Session Creation**: A child session is created with:
   - The subagent's custom system message
   - Disabled parent chat history interference
   - All tools except the Subagent tool itself
4. **Execution**: The subagent executes autonomously using the provided prompt
5. **Streaming**: Output streams back to the parent via the `toolCallId`
6. **Completion**: The final response is returned to the parent agent with status metadata
7. **Cleanup**: The child session resources are cleaned up, and the parent's system message and chat history state are restored

## Error Handling

Subagent execution includes comprehensive error handling:

- **Validation Errors**: Invalid agent types or missing parameters are caught early
- **Execution Errors**: Runtime errors are logged and returned with detailed messages
- **Graceful Degradation**: Failed subagent execution returns an error result without crashing the parent agent
- **State Restoration**: Original system message and chat history state are always restored, even if the subagent fails

## Future Enhancements

Potential improvements to the subagent system:

- **Custom Agent Types**: Support for specialized agents (e.g., "researcher", "implementer", "reviewer")
- **Tool Restrictions**: Fine-grained control over which tools each agent type can access
- **Model Selection**: Allow specifying different models for different agent types
- **Subagent Chaining**: Enable subagents to spawn their own subagents for hierarchical task decomposition
- **Result Caching**: Cache subagent results for frequently executed tasks
- **Parallel Execution**: Run multiple subagents concurrently for independent tasks

---

This document describes the initial subagent implementation. Update it as the feature evolves.
