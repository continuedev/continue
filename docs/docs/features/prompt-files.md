# Prompt files (experimental)

Prompt files provide a convenient way to standardize common patterns and share a collection of LLM prompts with your team. They make it easy to build and use these prompts.

## Quick start

:::tip[Prompt library]
To assist you in getting started, [we've curated a small library of `.prompt` files](https://github.com/continuedev/prompt-file-example). We encourage community contributions to this repository, so please consider opening up a pull request with your own prompts!
:::

Below is a quick example of setting up a prompt file to write unit tests using Jest.

1. Create a folder called `.prompts/` at the top level of your workspace.
2. Add a file called `test.prompt` to this folder. The name of this file will be the name of the slash command you will use to generate your prompt.
3. Write the following contents to `test.prompt` and save.

```
temperature: 0.5
maxTokens: 4096
---
<system>
You are an expert programmer
</system>

{{{ input }}}

Write unit tests for the above selected code, following each of these instructions:
- Use `jest`
- Properly set up and tear down
- Include important edge cases
- The tests should be complete and sophisticated
- Give the tests just as chat output, don't edit any file
- Don't explain how to set up `jest`
```

Now to use this prompt, you can highlight code and use `cmd/ctrl+L` to select it in the Continue sidebar.

Then, type "/" to see the list of slash commands and choose the one called "test". Press enter and the LLM will respond given the instructions from your prompt file.

## Format

The format is inspired by [HumanLoops's .prompt file](https://docs.humanloop.com/docs/prompt-file-format), with additional templating to use context providers and built-in variables using [Handlebars syntax](https://handlebarsjs.com/guide/).

:::info
The current state of this format is experimental and subject to change
:::

### Preamble

The "preamble" is everything above the `---` separator, and lets you specify model parameters. It uses YAML syntax and currently supports the following parameters:

- `name`
- `temperature`
- `topP`
- `topK`
- `minP`
- `presencePenalty`
- `frequencyPenalty`
- `mirostat`
- `stop`
- `maxTokens`
- `description`

If you don't need any of these parameters, you can leave out the preamble and do not need to include the `---` separator.

### System message

To add a system message, start the body with `<system></system>` tags like in the example above and place your system message inside.

### Built-in variables

The following built-in variables are currently available:

- `{{{ input }}}` - The full text from the input box in the sidebar that is sent along with the slash command
- `{{{ currentFile }}}` - The currently open file in your IDE
- `{{{ ./path/to/file.js }}}` - Any file can be directly referenced

### Context providers

Any [context provider](../customization/context-providers.md) that you have added to your config can be referenced using the name of the context provider. Context providers that receive an input are also supported.

- `{{{ terminal }}}` - The contents of the terminal
- `{{{ url "https://github.com/continuedev/continue" }}}` - The contents of a URL

## Feedback

If you have ideas about how to improve the `.prompt` file format, please reach out on [Discord](https://discord.gg/NWtdYexhMs).
