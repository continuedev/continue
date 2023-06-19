<h1 align="center"> Continue </h1>

<div align="center">

**[Continue](https://continue.dev/docs) is the open-source library for accelerating software development with language models**

</div>

<div align="center">

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
![GitHub issues](https://img.shields.io/github/issues-raw/continuedev/continue)
![GitHub Repo stars](https://img.shields.io/github/stars/continuedev/continue?style=social)
![Twitter URL](https://img.shields.io/twitter/url?style=social&url=https%3A%2F%2Fgithub.com%2Fcontinuedev%2Fcontinue)

</div>

## Getting Started

### Install for VS Code

Learn how to install locally in VS Code [here](https://continue.dev/docs/install)

### GitHub Codespaces

Explore Continue in GitHub Codespaces [here](https://continue.dev/docs/getting-started) if you'd like to try without downloading for VS Code.

## How to contribute

Open a [new GitHub Issue](https://github.com/continuedev/continue/issues/new) or comment on [an existing one](https://github.com/continuedev/continue/issues). Let us know what you would like to contribute, and we will help you make it happen!

## Install from source

#### 1. Clone this repo

Recommended: Run this command to use SSH

```bash
git clone git@github.com:continuedev/continue.git
```

Alternative: Run this command to use HTTPS

```bash
git clone https://github.com/continuedev/continue
```

#### 2. Install Continue

Run this command to use the install script

```bash
cd continue/extension/scripts && python3 install_from_source.py
```

# Understanding the codebase

- [Continue Server README](./continuedev/README.md): learn about the core of Continue, which can be downloaded as a [PyPI package](https://pypi.org/project/continuedev/)
- [VS Code Extension README](./extension/README.md): learn about the capabilities of our extension—the first implementation of Continue's IDE Protocol—which makes it possible to use use Continue in VS Code and GitHub Codespaces
- [Continue GUI README](./extension/react-app/): learn about the React app that lets users interact with the server and is placed adjacent to the text editor in any suppported IDE
- [Schema README](./schema): learn about the JSON Schema types generated from Pydantic models, which we use across the `continuedev/` and `extension/` directories
- [Continue Docs README](./docs): learn how our [docs](https://continue.dev/docs) are written and built
- [How to debug the VS Code Extension README](./extension/src/README.md): learn how to set up the VS Code extension, so you can debug it

# License

[Apache 2.0 © 2023 Continue Dev, Inc.](./LICENSE)
