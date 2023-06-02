# GUI

**TODO: Make sure codebase aligns with this terminology**

:::info
The **Continue GUI** lets you transparently review every automated step, providing the opportunity to undo and rerun any that ran incorrectly.
:::

## Details

GUI displays every step taken by Continue in a way that lets you easily review, reverse, refine, re-run. Provides a natural language prompt where you can request edits in natural language or initiate recipes with slash commands. Communicates with the Continue server via GUI Protocol. Is a React app, which will eventually be published as a standalone npm package, importable as a simple React component.

- **From GUI to Core**
  - Natural language instructions from the developer
  - Hover / clicked on a step
  - Other user input
- **From Core to GUI**
  - Updates to state (e.g. a new step)
