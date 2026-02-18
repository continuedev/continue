# Contributing to Continue (JetBrains extension) <!-- omit in toc -->

This file is for contribution guidelines specific to the JetBrains extension. See the root [
`CONTRIBUTING.md`](../../CONTRIBUTING.md) for general contribution guidelines.

## Table of Contents <!-- omit in toc -->

- [Architecture Overview](#architecture-overview)
- [Environment Setup](#environment-setup)
  - [IDE Installation](#ide-installation)
  - [IDE configuration](#ide-configuration)
    - [Recommended plugins](#recommended-plugins)
  - [Node.js Requirements](#nodejs-requirements)
  - [Install all dependencies](#install-all-dependencies)
  - [Misc](#misc)
- [Development Workflow](#development-workflow)
  - [Running the extension in debug mode](#running-the-extension-in-debug-mode)
  - [Accessing files in the `.continue` directory](#accessing-files-in-the-continue-directory)
  - [Viewing logs](#viewing-logs)
  - [Reloading changes](#reloading-changes)
  - [Setting breakpoints](#setting-breakpoints)
  - [Available Gradle tasks](#available-gradle-tasks)
  - [Packaging](#packaging)
    - [Installing the packaged extension](#installing-the-packaged-extension)
- [Testing](#testing)
  - [e2e testing](#e2e-testing)
    - [Overview](#overview)
    - [Setup](#setup)
    - [Running the tests](#running-the-tests)
    - [Identifying selectors](#identifying-selectors)
    - [Rebuilding the extension](#rebuilding-the-extension)

## Architecture Overview

This extension shares much of the code with the VS Code extension by utilizing shared code in the `core` directory and
packaging it in a binary in the `binary` directory. Communication occurs over stdin/stdout.

## Environment Setup

### IDE Installation

Continue is built with JDK version 17 (as specified in [`./build.gradle.kts`](./build.gradle.kts)), which can be
downloaded from [Oracle](https://www.oracle.com/java/technologies/javase/jdk17-archive-downloads.html).

We recommend using IntelliJ IDEA, which you can download from
the [JetBrains website](https://www.jetbrains.com/idea/download).

Both Ultimate and Community (free) editions are suitable for this project, although Ultimate has better debugging (see
notes below).

### IDE configuration

- Enable code formatting on save: `Settings | Tools | Actions on Save | Reformat code`

#### Recommended plugins

- [Thread Access Info](https://plugins.jetbrains.com/plugin/16815-thread-access-info) - adds an extra debug panel
  showing possible thread access violation (according to Intellij Platform SDK guidelines)
- [File Expander](https://plugins.jetbrains.com/plugin/11940-file-expander) - allows you to easily preview archives as
  directories (like `build/distributions/continue-*.zip`)

### Node.js Requirements

This project requires Node.js version 20.19.0 (LTS) or higher. You have two options for installation:

1. Download and install directly from [nodejs.org](https://nodejs.org/en/download).
2. If you're using NVM (Node Version Manager), set the correct Node.js version for this project by running `nvm use` in
   the project root.

### Install all dependencies

- Unix: `./scripts/install-dependencies.sh`
- Windows: `.\scripts\install-dependencies.ps1`

### Misc

- Ensure that you have the Gradle plugin installed

## Development Workflow

### Running the extension in debug mode

Select the `Run Continue` task in the top right corner of the IDE and then select the "Debug" option.

> In community edition, use `Run Continue (CE)` instead, which uses shell scripts instead of Ultimate-only node configs.
> If you want to debug the core in CE, you'll need to quit the `Start Core Dev Server (CE)` process and run the core in
> a
> different environment that supports debugging, such as VS Code (Launch "Core Binary").

![run-extension-screenshot](../../media/run-continue-intellij.png)

This should open a new instance on IntelliJ with the extension installed.

### Accessing files in the `.continue` directory

When running the `Start Core Dev Server` task, we set the location of your Continue directory to
`./extensions/.continue-debug`. This is to
allow for changes to your `config.json` and other files during development, without affecting your actual configuration.

### Viewing logs

When using the `Run Continue` task, we automatically tail both prompt logs and IDE logs.

#### Viewing more IDE logs

You can selectively increase the log granularity (e.g., debug-level logs) as follows:

- Navigate to `Help | Diagnostic Tools | Debug Log Settings...`
- Add a line in the format: `com.intellij.diagnostic:debug`

You can find more information about this feature in [official docs](https://youtrack.jetbrains.com/articles/SUPPORT-A-43/How-to-enable-debug-logging-in-IntelliJ-IDEA).

### Developing `build.plugin.kts`

If in doubt, check out the
official [IntelliJ Platform Plugin Template](https://github.com/JetBrains/intellij-platform-plugin-template).
These templates are the most up-to-date examples of how to correctly customize the plugin build scripts.

Also, check out
the [useful recipes](https://plugins.jetbrains.com/docs/intellij/tools-intellij-platform-gradle-plugin-recipes.html)
for common problems.

### Adding new extensions in `plugin.xml`

There's a tool called [JetBrains Platform Explorer](https://plugins.jetbrains.com/intellij-platform-explorer) that
aggregates plugin metadata and allows you to filter by specific
extension points. If you're having trouble implementing a feature that's not officially documented,
you can learn from other open source plugins.

### Reloading changes

- `extensions/intellij`: Attempt to reload changed classes by selecting
  _Run | Debugging Actions | Reload Changed Classes`_
  - This will often fail on new imports, schema changes etc. In that case, you need to stop and restart the extension
- `gui`: Changes will be reloaded automatically
- `core`: Run `npm run build -- --os [darwin | linux | win32]` from the `binary` directory (requires
  restarting the
  `Start Core Dev Server` task)

### Setting breakpoints

- `extensions/intellij`: Breakpoints can be set in Intellij
- `gui`: You'll need to set explicit `debugger` statements in the source code, or through the browser dev tools
- `core`: Breakpoints can be set in Intellij (requires restarting the `Start Core Dev Server` task)
  - If you have Community Edition installed, you won't be able to use breakpoints in IntelliJ. Instead, you can start
    the `Core Binary` task in VS Code and set breakpoints in that IDE.

### Available Gradle tasks

To see the list of Gradle tasks available, you can run the following:

```shell
./gradlew tasks
```

A handful of the most relevant tasks are outlined below:

```shell
build - Assembles and tests this project.
clean - Deletes the build directory.
dependencies - Displays all dependencies declared in root project 'continue-intellij-extension'
runIde - Runs the IDE instance with the developed plugin installed.
verifyPluginConfiguration - Checks if Java and Kotlin compilers configuration meet IntelliJ SDK requirements
```

### Packaging

- Unix: `./gradlew buildPlugin`
- Windows: `./gradlew.bat buildPlugin`

This will generate a .zip file in `./build/distributions` with the version defined in [
`./gradle.properties`](./gradle.properties)

#### Installing the packaged extension

- Navigate to the Plugins settings page (_Settings | Plugins_)
- Click on the gear icon
- Click _Install from disk_ and select the ZIP file in `./build/distributions`

## Testing

Test commands:

- `./gradlew test` - to run **unit tests**
- `./gradlew testIntegration` - to run **e2e tests**

### About e2e tests

The e2e tests are written using [intellij-ide-starter](https://github.com/JetBrains/intellij-ide-starter).
The first run of the e2e tests may take a while because the required IDE needs
to be downloaded. Note that these tests
fully take control of your mouse while executing.

#### Setup

If you are on macOS, you'll need to give IntelliJ permission to control your computer in order to run the e2e tests.
Open `System Settings > Privacy & Security > Accessibility` and toggle the switch for IntelliJ.

#### Working with Intellij IDE Starter

The testing platform provides a rich DSL for most UI components in IntelliJ. However, if you want to interact with a
custom element, you can define your own XPath selector.

To do this, run an e2e test and visit [localhost:63343/api/remote-driver/](http://localhost:63343/api/remote-driver/) to
view an HTML representation of the IDE's Swing component tree.
See [Integration Tests](https://plugins.jetbrains.com/docs/intellij/integration-tests-ui.html#searching-components) for
more details about this workflow.
