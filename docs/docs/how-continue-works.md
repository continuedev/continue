# How Continue works

![Continue Architecture Diagram](/img/continue-architecture.png)

The `Continue` library consists of an **SDK**, a **GUI**, and a **Server** that brings everything together.

1. The **SDK** gives you access to the tools (e.g. open a directory, edit a file, call a model, etc.) needed to define steps that integrate LLMs into your IDE and workflows.

2. The **GUI** lets you transparently review every automated step, providing the opportunity to undo and rerun any that ran incorrectly.

3. The **Server** is responsible for connecting the GUI and SDK to the IDE as well as deciding which steps to take next.