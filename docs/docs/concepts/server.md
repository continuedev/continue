# Server

**TODO: Better explain in one sentence what this is and what its purpose is**

:::info
The **Continue Server** holds the main event loop, responsible for connecting [IDE](./ide.md) (i.e. in VS Code, GitHub Codespaces, a web browser text editor, etc), [SDK](./sdk.md), and [GUI](./gui.md), and deciding which steps to take next.
:::

## Details

The Continue server communicates with the IDE and GUI through websockets, acting as the communication bridge and main event loop. The `Autopilot` class is where most of this happens, accepting user input, calling on a policy to decide the next step, and injecting the `ContinueSDK` to run steps.
