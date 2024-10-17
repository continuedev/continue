# Contributing to Continue (JetBrains extension) <!-- omit in toc -->

This file is for contribution guidelines specific to the JetBrains extension. See the root [`CONTRIBUTING.md`](../../CONTRIBUTING.md) for general contribution guidelines.

## Table of Contents <!-- omit in toc -->

- [Architecture Overview](#architecture-overview)
- [Environment Setup](#environment-setup)
  - [IDE Installation](#ide-installation)
  - [IDE configuration](#ide-configuration)
  - [Node.js Requirements](#nodejs-requirements)
  - [Install all dependencies](#install-all-dependencies)
  - [Misc](#misc)
- [Development Workflow](#development-workflow)
  - [Running the extension](#running-the-extension)
  - [Available Gradle tasks](#available-gradle-tasks)
- [Debugging](#debugging)
  - [Reloading changes](#reloading-changes)
  - [Setting breakpoints](#setting-breakpoints)
- [Packaging](#packaging)

## Architecture Overview

This extension shares much of the code with the VS Code extension by utilizing shared code in the `core` directory and
packaging it in a binary in the `binary` directory. Communication occurs over stdin/stdout.

## Environment Setup

### IDE Installation

We recommend using IntelliJ IDEA, which you can download from
the [JetBrains website](https://www.jetbrains.com/idea/download).

Both Ultimate and Community (free) editions are suitable for this project. Continue is built with JDK version 17, as
specified in [`./build.gradle.kts`](./build.gradle.kts).

### IDE configuration

- Enable code formatting on save: `Settings | Tools | Actions on Save | Reformat code`

### Node.js Requirements

This project requires Node.js version 20.11.0 (LTS) or higher. You have two options for installation:

1. Download and install directly from [nodejs.org](https://nodejs.org/en/download).
2. If you're using NVM (Node Version Manager), set the correct Node.js version for this project by running `nvm use` in
   the project root.

### Install all dependencies

- Unix: `./scripts/install-dependencies.sh`
- Windows: `.\scripts\install-dependencies.ps1`

### Misc

- Ensure that you have the Gradle plugin installed

## Development Workflow

### Running the extension

- Select the "Run Continue" Gradle configuration in the top-right corner of the IDE
- Click the "Run" or "Debug" button
  - The first time running this will install the IDE version specified by the `platformVersion` property in [`./run/Run Continue.run.xml`](./.run/Run%20Continue.run.xml). This will take a moment as the installation size can be close to 1GB.

![run-extension-screenshot](../../media/run-intellij-extension.png)

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

## Debugging

### Reloading changes

- `extensions/intellij`: Attempt to reload changed classes by selecting
  `Run | Debugging Actions | Reload Changed Classes`
  - This will often fail on new imports, schema changes etc. In that case, you need to stop and restart the extension
- `gui`: Run `npm run build` from the `gui` directory
- `core`: Run `npm run build` from the `binary` directory

### Setting breakpoints

- `extensions/intellij`: Run the extension in debug mode
- `gui`: You'll need to set explicit `debugger` statements in the source code, or through the browser dev tools
- `core`: To set breakpoints in `core`, we need to start `binary` in a debug configuration
  - Select the "Run Continue (TCP)" task in the top right corner
  - Open the project in a VS Code window (we recommend this for a preconfigured Typescript debugging experience)
  - Select the "Core Binary" task from the Run and Debug panel
  - You can now set breakpoints in `core`. Note that if you make changes, you'll need to restart the "Core Binary"
    task and reload changes classes in Intellij.

## Packaging

- Unix: `./gradlew build`
- Windows: `./gradlew.bat build`

This will generate a .zip file in `./build/distributions` with the version defined in [`./gradle.properties`](./gradle.properties)
