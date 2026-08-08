# Continue JetBrains Extension

## Project Purpose

JetBrains/IntelliJ extension for Continue AI code agent. Provides chat, autocomplete, inline edit, and agent features within JetBrains IDEs.

## Architecture

- **Language**: Kotlin (JDK 17), Gradle build
- **Communication**: stdin/stdout message passing with core binary from `../../binary`
- **UI**: Embeds React webview from `../../gui`
- **Platform**: IntelliJ Platform Plugin (IDEA, PyCharm, WebStorm, etc.)

## Key Source Structure

```
src/main/kotlin/com/github/continuedev/continueintellijextension/
├── continue/         # Core integration (CoreMessenger, IntelliJIde, IdeProtocolClient)
├── autocomplete/     # Code completion logic
├── editor/          # Diff handling, inline edits
├── toolWindow/      # Main UI panel
├── services/        # Settings, plugin lifecycle
├── actions/         # Keyboard shortcuts, menu actions
├── protocol/        # Message type definitions
└── constants/       # App constants, paths

src/main/resources/
├── META-INF/plugin.xml  # Plugin configuration
└── webview/            # Embedded React UI assets
```

## Core Files

- `IntelliJIde.kt`: Main IDE interface implementation
- `CoreMessenger.kt`: Binary communication handler
- `plugin.xml`: Plugin manifest and extension points
- `build.gradle.kts`: Build configuration
- `ContinuePluginService.kt`: Main service orchestrator

## Message Protocol

JSON messages between Extension ↔ Core ↔ GUI. Message types in `constants/MessageTypes.kt`. Extension relays messages between core binary and webview.

## Testing

- Unit tests: `src/test/kotlin/`
- E2E tests: UI automation with intellij-ui-test-robot
- Test command: `./gradlew test`
- Debug: `runIde` Gradle task

## Key Integration Points

- File operations via IntelliJ VFS
- Editor integration for diffs/autocomplete
- Git operations for repository context
- Settings via IntelliJ platform storage
