---
title: Telemetry
description: Learn how Continue collects anonymous usage information and how you can opt out.
keywords: [telemetry, anonymous, usage info, opt in]
---

## Overview

Continue collects and reports **anonymous** usage information to help us improve our product. This data enables us to understand user interactions and optimize the user experience effectively. By default your usage information is not shared. Please consider opting in to improve our product and help the community.

We utilize [Posthog](https://posthog.com/), an open-source platform for product analytics, to gather and store this data. For transparency, you can review the implementation code [here](https://github.com/continuedev/continue/blob/main/gui/src/hooks/CustomPostHogProvider.tsx) or read our [official privacy policy](https://continue.dev/privacy).

## Tracking Policy

All data collected by the open-source Continue extensions is anonymized and stripped of personally identifiable information (PII) before being sent to PostHog. We are committed to maintaining the privacy and security of your data.

## What We Track

The following usage information is collected and reported:

- **Suggestion Interactions:** Whether you accept or reject suggestions (excluding the actual code or prompts involved).
- **Model and Command Information:** The name of the model and command used.
- **Token Metrics:** The number of tokens generated.
- **System Information:** The name of your operating system (OS) and integrated development environment (IDE).
- **Pageviews:** General pageview statistics.

## How to Opt In

You can enable anonymous telemetry by visiting the [User Settings Page](./customize/settings.md) and toggling "Allow Anonymous Telemetry" on.

Alternatively in VS Code, you can enable telemetry through your VS Code settings by checking the "Continue: Telemetry Enabled" box (this will override the Settings Page settings). VS Code settings can be accessed with `File` > `Preferences` > `Settings` (or use the keyboard shortcut <kbd>ctrl</kbd> + <kbd>,</kbd> on Windows/Linux or <kbd>cmd</kbd> + <kbd>,</kbd> on macOS).
