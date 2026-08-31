<h1 align="center">Shadow Code</h1>

<p align="center">AI code agent — VS Code extension, JetBrains plugin, and CLI</p>

<div align="center">

<a href="https://opensource.org/licenses/Apache-2.0"><img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" /></a>

</div>

## What is Shadow Code?

Shadow Code is an AI coding agent available as a [VS Code extension](extensions/vscode),
a [JetBrains plugin](extensions/intellij), and a [CLI](extensions/cli). It can chat about
your codebase, make multi-file edits, run an autonomous agent with tool access, and
provide inline autocomplete.

It is a fork of the Continue open-source project, with a focus on using coding-agent CLIs
you already subscribe to (Claude Code, etc.) as the model backend instead of paying
per-token for an API key.

## Repository layout

| Path                   | What it is                                                   |
| ---------------------- | ------------------------------------------------------------ |
| `core/`                | Shared engine — config, LLM providers, tools, indexing       |
| `gui/`                 | React webview UI                                             |
| `extensions/vscode/`   | VS Code extension host                                       |
| `extensions/intellij/` | JetBrains plugin                                             |
| `extensions/cli/`      | Command-line interface                                       |
| `binary/`              | Core packaged as a standalone executable (used by JetBrains) |
| `packages/`            | Independently published support packages                     |

## Configuration

Global config lives in `~/.shadow-code/config.yaml`. Per-workspace rules, prompts, and
assistants live in a `.shadow-code/` folder in your project.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[Apache-2.0](LICENSE). Shadow Code is a fork of the Continue open-source project.
