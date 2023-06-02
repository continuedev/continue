# Core

**TODO: Better explain in one sentence what this is and what its purpose is**

:::info
The **Continue Core** holds the main event loop, responsible for connecting [IDE](./ide.md) (i.e. in VS Code, GitHub Codespaces, a web browser text editor, etc), [SDK](./sdk.md), and [GUI](./gui.md), and deciding which steps to take next.
:::

## Details

I tried a rewrite of the info box above. The core doesn't really mean that much except for maybe the Autopilot class and the small set of classes in core.py, including History, Step, Policy mostly. Maybe best referred to as a set of abstractions. Autopilot runs the main event loop, basically queueing user input and asking the policy what to do next, and injecting the SDK, and recording history. I suppose you could also say it includes the protocols, in which case you might say "connects IDE and GUI through the SDK", though lots of 3-letter acronyms going on here. Notes below are correct.

- The `Core` includes
  - IDE protocol
  - GUI protocol
  - SDK
  - Autopilot
- There is a two-way sync between an IDE and the GUI that happens through Core
