<!-- Plugin description -->

<h1 align="center">Continue</h1>

<div align="center">

[**Continue**](https://docs.continue.dev) enables developers to create, share, and use custom AI code assistants with our open-source [JetBrains extension](https://plugins.jetbrains.com/plugin/22707-continue-extension) and [hub of models, rules, prompts, docs, and other building blocks](https://hub.continue.dev).

</div>

<div align="center">

## Chat

[Chat](https://continue.dev/docs/chat/how-to-use-it) makes it easy to ask for help from an LLM without needing to leave the IDE.

You send it a task, including any relevant information, and it replies with the text / code most likely to complete the task. If it does not give you what you want, then you can send follow up messages to clarify and adjust its approach until the task is completed.

## Autocomplete

[Autocomplete](https://continue.dev/docs/autocomplete/how-to-use-it) provides inline code suggestions as you type.

To enable it, simply click the "Continue" button in the status bar at the bottom right of your IDE or ensure the "Enable Tab Autocomplete" option is checked in your IDE settings.

## Edit

[Edit](https://continue.dev/docs/edit/how-to-use-it) is a convenient way to modify code without leaving your current file.

Highlight a block of code, describe your code changes, and a diff will be streamed inline to your file which you can accept or reject.

## Agent

[Agent](https://continue.dev/docs/agent/how-to-use-it) enables you to make more substantial changes to your codebase

Agent equips the Chat model with the tools needed to handle a wide range of coding tasks, allowing the model to make decisions and save you the work of manually finding context and performing actions.

</div>

## Development Setup

### Prerequisites

This project requires Java 17. If you encounter a "Cannot find a Java installation" error, follow these steps:

1. **Install Java 17** (if not already installed):

   ```bash
   sudo apt update
   sudo apt install openjdk-17-jdk
   ```

2. **Set JAVA_HOME**:

   ```bash
   export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
   ```

3. **Or use the setup script**:

   ```bash
   source setup-env.sh
   ```

4. **Build the project**:
   ```bash
   ./gradlew build
   ```

The `gradle.properties` file has been configured to automatically use Java 17, so the JAVA_HOME setting should only be needed for the first build.

## License

[Apache 2.0 © 2023-2025 Continue Dev, Inc.](./LICENSE)

<!-- Plugin description end -->
