# Slash Commands

Slash commands are shortcuts that can be activated by prefacing your input with '/'. For example, the built-in '/edit' slash command let you stream edits directly into your editor.

There are two ways to add custom slash commands:

1. With natural language prompts - this is simpler and only requires writing a string or string template.
2. With a custom `Step` - this gives you full access to the Continue SDK and allows you to write arbitrary Python code.

## "Custom Commands" (Use Natural Language)

You can add custom slash commands by adding a `CustomCommand` object to the `custom_commands` property. Each `CustomCommand` has

- `name`: the name of the command, which will be invoked with `/name`
- `description`: a short description of the command, which will appear in the dropdown
- `prompt`: a set of instructions to the LLM, which will be shown in the prompt

Custom commands are great when you are frequently reusing a prompt. For example, if you've crafted a great prompt and frequently ask the LLM to check for mistakes in your code, you could add a command like this:

```python
config = ContinueConfig(
    ...
    custom_commands=[
        CustomCommand(
            name="check",
            description="Check for mistakes in my code",
            prompt=dedent("""\
            Please read the highlighted code and check for any mistakes. You should look for the following, and be extremely vigilant:
            - Syntax errors
            - Logic errors
            - Security vulnerabilities
            - Performance issues
            - Anything else that looks wrong

            Once you find an error, please explain it as clearly as possible, but without using extra words. For example, instead of saying "I think there is a syntax error on line 5", you should say "Syntax error on line 5". Give your answer as one bullet point per mistake found.""")
        )
    ]
)
```

## Custom Slash Commands

If you want to go a step further than writing custom commands with natural language, you can use a `SlashCommand` to run an arbitrary Python function, with access to the Continue SDK. To do this, create a subclass of `Step` with the `run` method implemented, and this is the code that will run when you call the command. For example, here is a step that generates a commit message:

```python
class CommitMessageStep(Step):
    async def run(self, sdk: ContinueSDK):

        # Get the root directory of the workspace
        dir = sdk.ide.workspace_directory

        # Run git diff in that directory
        diff = subprocess.check_output(
            ["git", "diff"], cwd=dir).decode("utf-8")

        # Ask the LLM to write a commit message,
        # and set it as the description of this step
        self.description = await sdk.models.default.complete(
            f"{diff}\n\nWrite a short, specific (less than 50 chars) commit message about the above changes:")

config=ContinueConfig(
    ...
    slash_commands=[
        ...
        SlashCommand(
            name="commit",
            description="Generate a commit message for the current changes",
            step=CommitMessageStep,
        )
    ]
)
```
