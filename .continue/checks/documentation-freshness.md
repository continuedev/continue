---
name: Documentation Freshness
description: Flag user-facing changes that lack corresponding documentation updates.
---

## Context

Continue has a public documentation site built from the `docs/` directory. When user-facing behavior changes, the docs must stay in sync. Stale docs erode trust and generate support requests. This check enforces the standards in `.continue/rules/documentation-standards.md`.

## What to Check

If the PR changes any of the following areas, verify that the corresponding docs are updated (or that the change is purely internal and doesn't affect user-facing behavior):

### Configuration and schemas

- `packages/config-yaml/` - YAML config schema changes should update `docs/customize/` or relevant config reference pages.

### Model providers

- `core/llm/llms/` - New or modified LLM provider integrations should update `docs/customize/model-providers/`.
- `core/llm/autodetect.ts` - Changes to model autodetection should be reflected in provider docs.

### Context providers

- `core/context/providers/` - New or changed context providers should update `docs/customize/context-providers.mdx`.

### Tools

- `core/tools/` - New or changed tools should update relevant docs pages.

### CLI commands

- `extensions/cli/src/commands/` - New or modified CLI commands should update `docs/cli/`.

### IDE extension features

- `extensions/vscode/src/commands.ts` - New VS Code commands should be documented.
- `extensions/vscode/package.json` - New settings or commands should be documented.

### Slash commands and agents

- `.continue/agents/` - Changes to agent capabilities should update `docs/agents/`.

## Pass/Fail Criteria

- **Pass** if no user-facing behavior is changed, or if the PR includes corresponding doc updates.
- **Pass** if the PR description explicitly notes that doc updates will follow in a separate PR.
- **Fail** if user-facing behavior is added or changed (new config options, new commands, changed defaults, new providers) without any documentation updates. Call out the specific feature and the doc page that likely needs updating.

## Exclusions

- Bug fixes that restore documented behavior (the docs are already correct).
- Internal refactors that don't change any public API or user-facing behavior.
- Test-only changes.
- Dependency updates that don't change behavior.
