const example = `
---
name: Example Agent / Workflow
description: Trying to wrap my head around what are these files
model: anthropic/claude-sonnet-4
tools:
  - linear-mcp
  - sentry-mcp:read-alerts
  - Read
  - Glob
  - Bash(git diff:*)
rules:
  - org/rule1
  - org/rule2
---
This is the prompt
`.trim();
