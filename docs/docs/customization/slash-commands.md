---
title: Slash Commands
description: Shortcuts that can be activated by prefacing your input with '/'
keywords: [slash command, custom commands, step]
---

# Slash Commands

Slash commands are shortcuts that can be activated by prefacing your input with '/'. For example, the built-in '/edit' slash command let you stream edits directly into your editor.

There are two ways to add custom slash commands:

1. With natural language prompts - this is simpler and only requires writing a string or string template.
2. With a custom `Step` - this gives you full access to the Continue SDK and allows you to write arbitrary Python code.

## "Custom Commands" (Use Natural Language)

You can add custom slash commands by adding to the `custom_commands` property in `config.json`.

- `name`: the name of the command, which will be invoked with `/name`
- `description`: a short description of the command, which will appear in the dropdown
- `prompt`: a set of instructions to the LLM, which will be shown in the prompt

Custom commands are great when you are frequently reusing a prompt. For example, if you've crafted a great prompt and frequently ask the LLM to check for mistakes in your code, you could add a command like this:

```json title="~/.continue/config.json"
custom_commands=[{
        "name": "check",
        "description": "Check for mistakes in my code",
        "prompt": "Please read the highlighted code and check for any mistakes. You should look for the following, and be extremely vigilant:\n- Syntax errors\n- Logic errors\n- Security vulnerabilities\n- Performance issues\n- Anything else that looks wrong\n\nOnce you find an error, please explain it as clearly as possible, but without using extra words. For example, instead of saying 'I think there is a syntax error on line 5', you should say 'Syntax error on line 5'. Give your answer as one bullet point per mistake found."
}]
```

## Custom Slash Commands

If you want to go a step further than writing custom commands with natural language, you can use a `SlashCommand` to run an arbitrary Python function, with access to the Continue SDK. This requires using `config.py` instead of `config.json`, unless you specify a built-in Step name.

To do this, create a subclass of `Step` with the `run` method implemented, and this is the code that will run when you call the command. For example, here is a step that generates a commit message:

```python title="~/.continue/config.py"
class CommitMessageStep(Step):
    async def run(self, sdk: ContinueSDK):

        # Get the root directory of the workspace
        dir = sdk.ide.workspace_directory

        # Run git diff in that directory
        diff = subprocess.check_output(
            ["git", "diff"], cwd=dir).decode("utf-8")

        # Ask the LLM to write a commit message,
        # and set it as the description of this step
        resp = await sdk.models.default.complete(
            f"{diff}\n\nWrite a short, specific (less than 50 chars) commit message about the above changes:")

        yield SetStep(description=resp)  # Updates are yielded so the UI can be incrementally updated

def modify_config(config: ContinueConfig) -> ContinueConfig:
    config.slash_commands.append(
        SlashCommand(
            name="commit",
            description="Generate a commit message for the current changes",
            step=CommitMessageStep,
        )
    )
    return config
```
