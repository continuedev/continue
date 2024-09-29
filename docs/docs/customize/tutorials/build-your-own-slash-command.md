---
title: Build your own slash command
---

There are two ways to add custom slash commands:

1. With natural language prompts - this is simpler and only requires writing a string or string template.
2. With a custom function - this gives you full access to the Continue SDK and allows you to write arbitrary Typescript code.

### "Custom Commands" (Use Natural Language)

You can add custom slash commands by adding to the `customCommands` property in `config.json`.

- `name`: the name of the command, which will be invoked with `/name`
- `description`: a short description of the command, which will appear in the dropdown
- `prompt`: a templated prompt to send to the LLM

Custom commands are great when you are frequently reusing a prompt. For example, if you've crafted a great prompt and frequently ask the LLM to check for mistakes in your code, you could add a command like this:

```json title="config.json"
customCommands=[{
        "name": "check",
        "description": "Check for mistakes in my code",
        "prompt": "{{{ input }}}\n\nPlease read the highlighted code and check for any mistakes. You should look for the following, and be extremely vigilant:\n- Syntax errors\n- Logic errors\n- Security vulnerabilities\n- Performance issues\n- Anything else that looks wrong\n\nOnce you find an error, please explain it as clearly as possible, but without using extra words. For example, instead of saying 'I think there is a syntax error on line 5', you should say 'Syntax error on line 5'. Give your answer as one bullet point per mistake found."
}]
```

#### Templating

The `prompt` property supports templating with Handlebars syntax. You can use the following variables:

- `input` (used in the example above): any additional input entered with the slash command. For example, if you type `/test only write one test`, `input` will be `only write one test`. This will also include highlighted code blocks.
- File names: You can reference any file by providing an absolute path or a path relative to the current working directory.

### Custom Slash Commands

If you want to go a step further than writing custom commands with natural language, you can write a custom function that returns the response. This requires using `config.ts` instead of `config.json`.

To do this, push a new `SlashCommand` object to the `slashCommands` list. This object contains "name", the name that you will type to invoke the slash command, "description", the description seen in the dropdown menu, and "run". The `run` function is any async generator that should yield strings as you want them to be streamed to the UI. As an argument to the function, you have access to a `ContinueSDK` object with utilities such as access to certain information/actions within the IDE, the current language model, and a few other utilities. For example, here is a slash command that generates a commit message:

```typescript title="~/.continue/config.ts"
export function modifyConfig(config: Config): Config {
  config.slashCommands?.push({
    name: "commit",
    description: "Write a commit message",
    run: async function* (sdk) {
      const diff = await sdk.ide.getDiff(true);
      for await (const message of sdk.llm.streamComplete(
        `${diff}\n\nWrite a commit message for the above changes. Use no more than 20 tokens to give a brief description in the imperative mood (e.g. 'Add feature' not 'Added feature'):`,
        {
          maxTokens: 20,
        },
      )) {
        yield message;
      }
    },
  });
  return config;
}
```
