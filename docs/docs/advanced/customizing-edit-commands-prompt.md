# Customizing /edit command's Prompt

You also have access to customize the prompt used in the '/edit' slash command. We already have a well-engineered prompt for GPT-4 and sensible defaults for less powerful open-source models, but you might wish to play with the prompt and try to find a more reliable alternative if you are for example getting English as well as code in your output.

To customize the prompt, use the `promptTemplates` property of any model, which is a dictionary, and set the "edit" key to a template string with Mustache syntax. The 'filePrefix', 'fileSuffix', 'codeToEdit', 'language', 'contextItems', and 'userInput' variables are available in the template. Here is an example of how it can be set in `config.ts`:

```typescript title="~/.continue/config.ts"
const codellamaEditPrompt = `\`\`\`{{{language}}}
{{{codeToEdit}}}
\`\`\`
[INST] You are an expert programmer and personal assistant. Your task is to rewrite the above code with these instructions: "{{{userInput}}}"

Your answer should be given inside of a code block. It should use the same kind of indentation as above.
[/INST] Sure! Here's the rewritten code you requested:
\`\`\`{{{language}}}`;

function modifyConfig(config: Config): Config {
  config.models[0].promptTemplates["edit"] = codellamaEditPrompt;
  return config;
}
```

You can find all existing templates for /edit in [`core/llm/templates/edit.ts`](https://github.com/continuedev/continue/blob/main/core/llm/templates/edit.ts).
