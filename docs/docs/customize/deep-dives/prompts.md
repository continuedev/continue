---
title: Prompts
---

Prompts are reusable instructions that can be referenced at any time during chat. They are especially useful as context for repetitive and/or complex tasks.

:::info
Visit the Hub to [explore prompts](https://hub.continue.dev/explore/prompts) or [create your own](https://hub.continue.dev/new?type=block&blockType=prompts)
:::

## Examples

Below are some examples to get you started.

### Security review

```text title="Security best practices review"
@open - Review these files for the following security best practices:
- Does the architecture follow security-by-design principles?
- Are there potential security vulnerabilities in the system design?
- Is sensitive data handled appropriately throughout the lifecycle?
```

### Reference best practice guides

```text title="Redux best practices review"
@https://redux.js.org/style-guide/
@currentFile

Review this code for adherence to Redux best practices.
```

### Pull in commonly used files for tasks

```text title="Generate a new TypeORM entity"
@src/db/dataSource.ts @src/db/entity/SampleEntity.ts

Use these files to generate a new TypeORM entity based on the following requirements:
```

## Including Context Providers in your prompts

Many [context providers](../context-providers.mdx) can be referenced by typing "@" followed by the name of the context provider. The currently supported list is:

- `@terminal` - The contents of the terminal
- `@currentFile` - The currently active file
- `@open` - All open files
- `@os` - Information about the operating system
- `@problems` - Problems reported by the language server in the active file
- `@repo-map` - A map of files in the repository
- `@tree` - A tree view of the repository structure

Or you can directly type URLs and file paths:

- `@https://github.com/continuedev/continue` - The contents of a URL
- `@src/index.ts` - The contents of a file (VS Code only)

All references will be attached as context items, rather than injected directly inline.

## Local `.prompt` files

In addition to Prompt blocks on the Hub, you can also define prompts in local `.prompt` files, located in the `.continue/prompts` folder at the top level of your workspace. This is useful for quick iteration on prompts to test them out before pushing up to the Hub.

### Quick Start

Below is a quick example of setting up a prompt file:

1. Create a folder called `.continue/prompts` at the top level of your workspace
2. Add a file called `test.prompt` to this folder.
3. Write the following contents to `test.prompt` and save.

```.prompt
name: Current file prompt
description: A test prompt using the current file context provider
---
@currentFile
```

Now to use this prompt, you can open Chat, type <kbd>/</kbd>, select the prompt, and add type out some additional text such as "Review the code for any issues".

### Format

The format is inspired by [HumanLoops's .prompt file](https://docs.humanloop.com/docs/prompt-file-format), with additional templating to reference files, URLs, and context providers.

:::info
The current state of this format is experimental and subject to change
:::

### Preamble

The "preamble" is everything above the `---` separator, and lets you specify model parameters. It uses YAML syntax and currently supports the following parameters:

- `name` - The display title
- `description` - The description you will see in the dropdown
- `version` - Can be either "1" (for legacy prompt files) or "2" (this is the default and does not need to be set)

If you don't need any of these parameters, you can leave out the preamble and do not need to include the `---` separator.
