# How Continue works

![Continue Architecture Diagram](/img/continue-architecture.png)

The `Continue` library consists of an [SDK](./concepts/sdk.md), a [GUI](./concepts/gui.md), and a [Server](./concepts/server.md) that brings everything together.

1. The [SDK](./concepts/sdk.md) gives you access to the tools (e.g. open a directory, edit a file, call a model, etc.) needed to define steps that integrate LLMs into your IDE and workflows.

2. The [GUI](./concepts/gui.md) lets you transparently review every automated step, providing the opportunity to undo and rerun any that ran incorrectly.

3. The [Server](./concepts/server.md) is responsible for connecting the IDE, SDK, and GUI together as well as deciding which steps to take next.

The Continue Server take actions in the IDE code editor as directed by recipes, which are written using the Continue SDK and run by a user using the Continue GUI.