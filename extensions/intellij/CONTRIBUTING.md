# Contributing to Continue (JetBrains) <!-- omit in toc -->

This file is for contribution guidelines specific to the JetBrains extension. See the root [`CONTRIBUTING.md`](../../CONTRIBUTING.md) for general contribution guidelines.

## Table of Contents <!-- omit in toc -->

- [Architecture Overview](#architecture-overview)
- [Environment Setup](#environment-setup)
  - [IDE Installation](#ide-installation)
  - [Node.js Requirements](#nodejs-requirements)
  - [Install all dependencies](#install-all-dependencies)
  - [Misc](#misc)
- [Development Workflow](#development-workflow)
  - [Running the extension](#running-the-extension)
  - [Packaging](#packaging)
- [Debugging](#debugging)
- [Editor config](#editor-config)

## Architecture Overview

This extension shares much of the code with the VS Code extension by utilizing shared code in the `core` directory and packaging it in a binary in the `binary` directory. Communication occurs over stdin/stdout.

## Environment Setup

### IDE Installation

We recommend using IntelliJ IDEA, which you can download from the [JetBrains website](https://www.jetbrains.com/idea/download).

Both Ultimate and Community (free) editions are suitable for this project. Continue is built with JDK version 17, as specified in [`./build.gradle.kts`](./build.gradle.kts).

### Node.js Requirements

This project requires Node.js version 20.11.0 (LTS) or higher. You have two options for installation:

1. Download and install directly from [nodejs.org](https://nodejs.org/en/download).
2. If you're using NVM (Node Version Manager), set the correct Node.js version for this project by running `nvm use` in the project root.

### Install all dependencies

- Unix: `./scripts/install-dependencies.sh`
- Windows: `.\scripts\install-dependencies.ps1`

### Misc

- Ensure that you have the Gradle plugin installed

## Development Workflow

### Running the extension

- Select the "Run Continue" Gradle configuration in the top-right corner of the IDE
- Click the "Run" or "Debug" button
  - The first time running this will install the IDE version specified in [`./run/Run Continue.run.xml`](./.run/Run%20Continue.run.xml) (`platformVersion` property). This will take a moment as the install size can be close to 1GB.

![run-extension-screenshot](../../media/run-intellij-extension.png)

### Packaging

This will generate a .zip file in [`extensions/intellij/build/distributions`](extensions/intellij/build/distributions) with the version defined in [`extensions/intellij/gradle.properties`](extensions/intellij/gradle.properties)

- Unix: `./gradlew build`
- Windows: `./gradlew.bat build`

1. If you make changes:
   - You may need to re-build before running the "Build Plugin" configuration.
   - If you change code from the `core` or `binary` directories, run `npm run build` from the `binary` directory to create a new binary.
   - If you change code from the `gui` directory, run `npm run build` from the `gui` directory to create a new bundle.
   - Any changes to the Kotlin code in the `extensions/intellij` directory will be automatically included when you run "Build Plugin".

## Debugging

[CoreMessenger.kt](./src/main/kotlin/com/github/continuedev/continueintellijextension/continue/CoreMessenger.kt) file.

For the sake of rapid development, it is also possible to configure this communication to happen over local TCP sockets:

1. In [CoreMessenger.kt](./extensions/intellij/src/main/kotlin/com/github/continuedev/continueintellijextension/continue/CoreMessenger.kt), change the `useTcp` variable to `true`.
2. Open a VS Code window (we recommend this for a preconfigured Typescript debugging experience) with the `continue` repository. Select the "Core Binary" debug configuration and press play.
3. Run the "Run Plugin" Gradle configuration.
4. You can now set breakpoints in any of the TypeScript files in VS Code. If you make changes to the code, restart the "Core Binary" debug configuration and reload the _Host IntelliJ_ window.

If you make changes to Kotlin code, they can often be hot-reloaded with "Run -> Debugging Actions -> Reload Changed Classes".
You're right. The organization could be improved to make it more coherent and logical. Here's a suggestion for reorganizing the content:

## Editor config

Install the following two IntelliJ plugins to format Java and Kotlin on file save
<https://plugins.jetbrains.com/plugin/8527-google-java-format>
<https://plugins.jetbrains.com/plugin/14912-ktfmt>
