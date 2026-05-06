<div align="center"></div>

<h1 align="center">Yuto Agentic</h1>

<div align="center">

<a target="_blank" href="https://opensource.org/licenses/Apache-2.0" style="background:none">
    <img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" style="height: 22px;" />
</a>
<a target="_blank" href="https://docs.yutoagentic.dev" style="background:none">
    <img src="https://img.shields.io/badge/Yuto%20Agentic-docs-%23BE1B55.svg" style="height: 22px;" />
</a>

<p></p>

**Open-source AI code agent — fork of [Continue](https://github.com/continuedev/continue)**

</div>

## Getting started

Paste this into your coding agent of choice:

```
Help me write checks for this codebase: https://yutoagentic.dev/walkthrough
```

## How it works

Yuto Agentic runs agents on every pull request as GitHub status checks. Each agent is a markdown file in your repo at `.yutoagentic/checks/`. Green if the code looks good, red with a suggested diff if not. Here is an example that performs a security review:

```yaml
---
name: Security Review
description: Review PR for basic security vulnerabilities
---
Review this PR and check that:
  - No secrets or API keys are hardcoded
  - All new API endpoints have input validation
  - Error responses use the standard error format
```

## Install CLI

AI checks are powered by the Yuto Agentic CLI (`yt`).

**macOS / Linux:**

```bash
curl -fsSL https://raw.githubusercontent.com/yutoagentic/yutoagentic/main/extensions/cli/scripts/install.sh | bash
```

**Windows (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/yutoagentic/yutoagentic/main/extensions/cli/scripts/install.ps1 | iex
```

Or with npm (requires Node.js 20+):

```bash
npm i -g @yutoagentic/cli
```

Then run:

```bash
yt
```

Looking for the VS Code extension? [See here](extensions/vscode/README.md).

## Contributing

Read the [contributing guide](https://github.com/yutoagentic/yutoagentic/blob/main/CONTRIBUTING.md), and
join the [GitHub Discussions](https://github.com/yutoagentic/yutoagentic/discussions).

This project is a fork of [Continue](https://github.com/continuedev/continue) — see [NAMING.md](./NAMING.md) for details on the rebrand.

## License

[Apache 2.0](./LICENSE)
