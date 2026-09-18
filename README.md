<h1 align="center">Ruckus</h1>

<p align="center">A fast, modern AI coding agent for your IDE</p>

<div align="center">

<a href="https://opensource.org/licenses/Apache-2.0"><img src="https://img.shields.io/badge/License-Apache_2.0-7c5cff.svg" /></a>
<a href="https://github.com/jakesixtyoneeighty/ruckuside/releases"><img src="https://img.shields.io/badge/Changelog-GitHub_Releases-7c5cff" /></a>

</div>

## What is Ruckus?

Ruckus is a coding agent that runs inside your editor. It reads your codebase,
edits files, runs tools, and works from the models you point it at.

Two things make it different from where it started:

- **Gateway-only model routing.** Models resolve through a single gateway
  rather than a provider grab-bag, so adding or swapping a model is a config
  change, not a code change.
- **Expanded Agent Skills.** Skills are first-class and bundled, so the agent
  can pick up repeatable workflows without bespoke prompting.

See [setup, migration, and testing](docs/development/ruckuside-gateway-skills.md).

## Install

### VS Code

Build and install the extension from source:

```bash
cd extensions/vscode && npm install && npm run package
```

Then install the generated `.vsix` from the VS Code Extensions view
(**⋯ → Install from VSIX…**).

### CLI

```bash
cd extensions/cli && npm install && npm run build
```

## Configuration

Ruckus keeps its configuration in `~/.ruckus`.

If you previously used Continue, your `~/.continue` directory is copied over
automatically the first time Ruckus runs — configs, sessions, and models come
with you. The old directory is left untouched, so an existing Continue install
keeps working.

Workspace files are read under either name: `.ruckusignore` or
`.continueignore`, `.ruckusrc.json` or `.continuerc.json`.

To point Ruckus somewhere else, set `RUCKUS_GLOBAL_DIR`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [TESTING.md](TESTING.md).

## Attribution

Ruckus is a fork of [Continue](https://github.com/continuedev/continue) by
Continue Dev, Inc., used under the Apache 2.0 license. The original project is
no longer actively maintained. Enormous credit to the Continue team and its
contributors — this codebase is their work, and Ruckus builds on it.

## License

Apache 2.0

Portions © 2023-2026 Continue Dev, Inc. See [LICENSE](LICENSE).
