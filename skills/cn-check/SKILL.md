---
name: cn-check
description: Install and run the Continue CLI (`cn`) to execute AI agent checks on local code changes. Use when asked to "run checks", "lint with AI", "review my changes with cn", or set up Continue CI locally.
license: Apache-2.0
metadata:
  author: continuedev
  version: "1.0.0"
---

# cn check — Local AI Agent Checks

Run AI-powered code checks locally against your working tree changes using the Continue CLI. Each check is an agent (defined in markdown) that reviews your diff, identifies issues, and optionally suggests fixes as a patch.

## When to Use

- User asks to run AI checks on their code changes
- User wants to set up `cn check` in a project
- User needs to create custom check agents
- User wants to apply AI-suggested fixes locally
- User asks about Continue CI or agent-based code review

## Installation

### Prerequisites

- Node.js 18+
- A git repository with uncommitted or branched changes

### Install the CLI

```bash
npm install -g @continuedev/cli
```

### Authenticate (required for Hub checks, optional for local-only)

```bash
cn login
```

This opens a browser for authentication. After login, Hub-configured checks are available automatically.

## Usage

### Basic: Run all discovered checks

```bash
cn check
```

This auto-detects checks from three sources (in priority order):

1. Hub API — checks configured for your repo on continue.dev
2. Local agents — markdown files in `.continue/agents/*.md`

### Specify agents explicitly

```bash
# Run a single local agent
cn check --agent .continue/agents/security-review.md

# Run a Hub-published agent
cn check --agent myorg/code-style

# Run multiple agents
cn check --agent .continue/agents/security.md --agent .continue/agents/docs.md
```

### Compare against a specific base branch

```bash
cn check --base develop
```

Default: auto-detects `main` or `master`.

### Output formats

```bash
# JSON output (for CI pipelines or scripting)
cn check --format json

# Unified patch output (pipe to git apply)
cn check --patch | git apply

# Stop on first failure
cn check --fail-fast
```

### Auto-fix mode

```bash
cn check --fix
```

Runs all checks, then applies any suggested patches directly to the working tree. Patches that conflict are reported but skipped.

## Creating a Check Agent

Create a markdown file at `.continue/agents/<name>.md`:

```markdown
# Security Review

You are a security reviewer. Examine the code changes for:

- SQL injection vulnerabilities
- XSS risks in user-facing output
- Hardcoded secrets or credentials
- Insecure use of eval() or similar

If you find issues, edit the files to fix them. If everything looks good, say so and exit.
```

The agent receives:

- The full diff against the base branch
- A list of changed files
- Access to read/edit files in a temporary worktree

Any edits the agent makes are captured as a patch and reported as a "fail" with suggested changes.

## How It Works

1. **Diff** — Computes `git diff <base>...HEAD` to find changed files
2. **Resolve** — Discovers which checks to run (Hub, local, or `--agent` flags)
3. **Worktree** — Creates a temporary git worktree per check for isolation
4. **Run** — Forks a worker process per check; the agent runs with full tool access
5. **Capture** — After the agent finishes, captures `git diff` in the worktree as a patch
6. **Report** — Renders results: pass (no changes), fail (patch produced), or error

Checks run in parallel by default. Use `--fail-fast` for sequential execution that stops on first failure.

## Output

### Interactive terminal (TTY)

A live-updating table shows check progress:

```
cn check  -  3 checks against main  -  5 changed files

Check               Status         Time
--------------------------------------------
Security Review     * Running       12s
Code Style          Pass            8s
Documentation       Pending         -
```

When complete, a full report prints with pass/fail status, agent output, and suggested patches.

### JSON output (`--format json`)

```json
{
  "checks": [
    {
      "agent": ".continue/agents/security.md",
      "name": "security",
      "status": "pass",
      "patch": "",
      "output": "No security issues found.",
      "duration": 8.2
    }
  ],
  "summary": {
    "total": 1,
    "passed": 1,
    "failed": 0,
    "errored": 0
  }
}
```

## CLI Reference

```
cn check [options]

Options:
  --base <branch>     Base branch for diff (default: auto-detect)
  --format <format>   Output format: text or json (default: text)
  --fix               Apply suggested fixes to working tree
  --patch             Output unified patch (pipe to git apply)
  --fail-fast         Stop after first failing check
  --agent <agent>     Agent to run (hub slug or local path, repeatable)
  --config <path>     Path to config file
  --org <slug>        Organization slug
  --verbose           Enable debug logging
```

## Troubleshooting

| Problem                      | Solution                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| "No changes detected"        | Make sure you have uncommitted changes or specify `--base`                            |
| "No checks found"            | Create `.continue/agents/*.md` files or run `cn login` for Hub checks                 |
| Check times out (5 min)      | Reduce diff size or split into focused agents                                         |
| "Worker exited with code 1"  | Run with `--verbose` to see worker stderr                                             |
| Patch conflicts with `--fix` | Apply patches manually: `cn check --patch > changes.patch && git apply changes.patch` |
