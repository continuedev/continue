---
name: IntelliJ Plugin Test Execution
description: Guidelines for running IntelliJ plugin tests with Gradle
alwaysApply: false
globs: extensions/intellij/**/*Test.kt
---

Run IntelliJ plugin tests using Gradle with the fully qualified test class or method name:

## Run test class

```bash
./gradlew test --tests "com.github.continuedev.continueintellijextension.unit.ApplyToFileHandlerTest"
```

## Run specific test method

```bash
./gradlew test --tests "com.github.continuedev.continueintellijextension.unit.ApplyToFileHandlerTest.should*"
```
