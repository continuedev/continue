# How `Continue` works

![Continue Architecture Diagram](/img/continue-architecture.png)

## Overview

The `Continue` library consists of an [SDK](./concepts/sdk.md), a [GUI](./concepts/gui.md), and a [Server](./concepts/server.md) that brings everything together.

1. The [SDK](./concepts/sdk.md) gives you access to the tools (e.g. open a directory, edit a file, call a model, etc.) needed to define steps that integrate LLMs into your IDE and workflows.

2. The [GUI](./concepts/gui.md) lets you transparently review every automated step, providing the opportunity to undo and rerun any that ran incorrectly.

3. The [Server](./concepts/server.md) holds the main event loop, responsible for connecting the IDE, SDK, and GUI together as well as deciding which steps to take next.

Continue connects any IDE (Integrated Development Environment) (e.g. VS Code, GitHub Codespaces, PyCharm, Replit, etc.) to the Continue Server, which take actions in the code editor as instructed by recipes that are run by a user through the GUI.