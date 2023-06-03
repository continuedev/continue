![GitHub issues](https://img.shields.io/github/issues-raw/continuedev/continue)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
![GitHub Repo stars](https://img.shields.io/github/stars/continuedev/continue?style=social)
![Twitter URL](https://img.shields.io/twitter/url?style=social&url=https%3A%2F%2Fgithub.com%2Fcontinuedev%2Fcontinue)

# Continue

Continue is the open-source autopilot for software developers. Using our SDK you can write short scripts, called recipes, that automate sequences of tasks that are common within your codebase. This repository contains:

- The Continue Python package, which offers an SDK to write recipes and the Continue server, which runs all automations
- The Continue VSCode extension, where you can natively run recipes and use natural language to refine code much faster

**[Read the docs](https://continuedev.netlify.app/)**

# Getting Started

The easiest way to start using Continue is to download our VS Code extension from the marketplace:

[Download for VS Code](https://marketplace.visualstudio.com/items?itemName=Continue.continue)

Alternatively, you can build from source. Just clone the repo and run a Python script:

```bash
git clone https://github.com/continuedev/continue && cd continue/extension/scripts && python3 install_from_source.py
```

# Writing Recipes

Check out the [recipes folder](https://github.com/continuedev/continue/tree/main/continuedev/src/continuedev/recipes) to learn how to write your own.

# Contributing

Please do! The easiest way to start contributing is by writing recipes, but PRs/suggestions of all kinds are welcome : )

# Subfolder READMEs

[PyPI Package (Continue Server)](./continuedev) - See here to learn about the Continue Server, which can be downloaded as a [PyPI package](https://pypi.org/project/continuedev/).

[Continue VS Code Extension](./extension) - See here to learn about the capabilities of our VS Code extension, which is the first implementation of Continue's IDE Protocol, built to be editor-agnostic. A README for developers is found in the [`src/` folder.](./extension/src).

[Continue GUI](./extension/react-app/) - The Continue GUI is a React app that lets users interact with the server. It is made to be placed adjacent to the text editor in your IDE.

[Docs](./docs) - The source for our documentation.

[Schema](./schema) - JSON Schema types generated from Pydantic models, used across the `continuedev` and `extension/` directories.

# License

[Apache-2.0](<[https://github.com/sestinj/the-x/blob/main/LICENSE](https://opensource.org/licenses/Apache-2.0)>) © 2023 Continue
