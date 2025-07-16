# Modes

Modes are flags that can be passed to the CLI for pre-configured tool permissions. The following modes are available:

## `readonly`

If `cn` is called with the `--readonly` flag, then only readonly tools are given to the model. Tools that can write to disk or make edits are left out. Each tool definition is marked with `readonly: boolean` to determine this.

## `no-tools`

If `cn` is called with the `--no-tools` flag, then no tools should be given to the model at all.
