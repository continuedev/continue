# SDK

*TODO: Explain in detail what this is and what its purpose is*

*TODO: Detail all the SDK methods and how to use them*

The `SDK` gives you access to tools (e.g. open a directory, edit a file, call an LLM, etc), which you can use when defining how a step should work and composing them with other steps.

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