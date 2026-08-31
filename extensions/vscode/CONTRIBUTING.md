# Shadow Code VS Code Extension

This is the Shadow Code VS Code extension. Its primary jobs are

1. Implement the IDE side of the Shadow Code IDE protocol, allowing Core to interact natively in an IDE.
2. Open the Shadow Code React app in a side panel. The React app's source code lives in the `gui` directory. The panel is opened by the `shadowCode.focusInput` command family, as defined in `src/commands.ts`.

# How to run the extension

See [Environment Setup](../../CONTRIBUTING.md#environment-setup)

# How to run and debug tests

After following the setup in [Environment Setup](../../CONTRIBUTING.md#environment-setup) you can run the `Extension (VSCode)` launch configuration in VS Code.
