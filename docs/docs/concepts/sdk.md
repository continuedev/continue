# SDK

## One sentence definition

The `Continue SDK` gives you access to tools (e.g. open a directory, edit a file, call an LLM, etc), which you can use when defining how a step should work and composing them with other steps.

## What else to know

The ContinueSDK has a `run_step` method, which allows Steps to be composable. The reason you want to run it with `run_step` instead of creating a Step and calling `step.run(...)` is so Continue can automatically keep track of the order of all steps run, and allow for reversibility, etc... The ContinueSDK also contains functions for very common steps, like `edit_file`, `add_file`, `run` (to run shell commands), and a few others. `sdk.history` lets you access the history of past steps. `sdk.llm` lets you use the Autopilot's language model like `sdk.llm.complete`. `sdk.ide` lets you take any action within the connected IDE (this is where the IDE protocol is called).

*TODO: Explain in detail what this is and what its purpose is*

*TODO: Detail all the SDK methods and how to use them*

## SDK methods

### run_step

### edit_file

Edits a file

#### Parameters

- `filepath` (required): the location of the file that should be edited
- `prompt` (required): instructions for how the LLM should edit the file

### run

Runs a command

#### Parameters

- `command` (required): the command that should be run

### wait_for_user_confirmation

Waits for the user to review the steps that ran before running the next steps

#### Paramaters

- `question` (required): asks the user to confirm something specific

### ide.getOpenFiles

Gets the name of the files that are open in the IDE currently

### sdk.ide.readFile

Gets the contents of the file located at the `filepath` 

#### Paramaters

- `filepath` (required): the location of the file that should be read

### sdk.ide.get_recent_edits

**Q: what does this method do?**