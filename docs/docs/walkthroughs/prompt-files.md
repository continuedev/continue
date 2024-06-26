# Prompt files (experimental)

Prompt (`.prompt`) files are an easy way to build and share LLM prompts with others. The format is inspired by [HumanLoops's .prompt file](https://docs.humanloop.com/docs/prompt-file-format), and adds templating so that you can easily refer to files, your current git diff, and eventually much more.

## How to create a prompt file

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

Now to use this prompt, you can highlight code and use cmd/ctrl+L to select it in the Continue sidebar. Then, type "/" to see the list of slash commands and choose the one called "test". Press enter and the LLM will respond given the instructions from your prompt file.

## Syntax

> The current state of this format is experimental and subject to change

### Preamble

The "preamble" is everything above the `---` separator, and lets you specify model parameters. It uses YAML syntax and currently supports the following parameters:

- `temperature`
- `topP`
- `topK`
- `minP`
- `presencePenalty`
- `frequencyPenalty`
- `mirostat`
- `stop`
- `maxTokens`
- `name`
- `description`

If you don't need any of these parameters, you can leave out the preamble and do not need to include the `---` separator.

### Body

The "body" is everything below the `---` separator, and contains your prompt.

At its most basic, the body can be just text.

To add a system message, start the body with `<system></system>` tags like in the example above and place your system message inside.

The body also supports templating with [Handlebars syntax](https://handlebarsjs.com/guide/). The following variables are currently available:

- `input`: The full text from the input box in the sidebar that is sent along with the slash command
- `currentFile`: The currently open file in your IDE

#### Context providers

The body of a .prompt file also supports any [context provider](../customization/context-providers.md) that you have added to your config by referencing the name of the context provider.

For example, if you wanted to include the contents of the terminal in your prompt, then you would use `{{{terminal}}}` in your prompt file. If you wanted to use the "url" context provider to include the contents of https://github.com/continuedev/continue, you would use `{{{url "https://github.com/continuedev/continue"}}}`, where the second part is the argument to the context provider, separated by a space.

## Feedback

If you have ideas about how to improve the `.prompt` file format, please reach out on [Discord](https://discord.gg/NWtdYexhMs).
