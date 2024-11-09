---
title: Telemetry
description: Learn how Continue collects anonymous usage information and how you can opt out.
keywords: [telemetry, anonymous, usage info, opt out]
---

## Overview

Continue collects and reports **anonymous** usage information to help us improve our product. This data enables us to understand user interactions and optimize the user experience effectively. You can opt out of telemetry collection at any time if you prefer not to share your usage information.

We utilize [Posthog](https://posthog.com/), an open-source platform for product analytics, to gather and store this data. For transparency, you can review the implementation code [here](https://github.com/continuedev/continue/blob/main/gui/src/hooks/CustomPostHogProvider.tsx) or read our [official privacy policy](https://continue.dev/privacy).

## Tracking Policy

All data collected by Continue is anonymized and stripped of personally identifiable information (PII) before being sent to PostHog. We are committed to maintaining the privacy and security of your data.

## What We Track

The following usage information is collected and reported:

- **Suggestion Interactions:** Whether you accept or reject suggestions (excluding the actual code or prompts involved).
- **Model and Command Information:** The name of the model and command used.
- **Token Metrics:** The number of tokens generated.
- **System Information:** The name of your operating system (OS) and integrated development environment (IDE).
- **Pageviews:** General pageview statistics.

## How to Opt Out

You can disable anonymous telemetry by modifying the `config.json` file located in the `~/.continue` directory. This file typically includes the following entry:

```json title="config.json"
{
  "allowAnonymousTelemetry": true
}
```

To opt out, change the value of `allowAnonymousTelemetry` to `false`. Alternatively, you can disable telemetry through your VS Code settings by unchecking the "Continue: Telemetry Enabled" box.

### Steps to Disable Telemetry via Configuration File

1. Open the `~/.continue/config.json` file in your text editor.
2. Locate the `"allowAnonymousTelemetry"` setting.
3. Change the value from `true` to `false`.
4. Save the file.

### Steps to Disable Telemetry via VS Code Settings

1. Open VS Code.
2. Navigate to `File` > `Preferences` > `Settings` (or use the keyboard shortcut <kbd>ctrl</kbd> + <kbd>,</kbd> on Windows/Linux or <kbd>cmd</kbd> + <kbd>,</kbd> on macOS).
3. In the search bar, type "Continue: Telemetry Enabled".
4. Uncheck the "Continue: Telemetry Enabled" checkbox.
