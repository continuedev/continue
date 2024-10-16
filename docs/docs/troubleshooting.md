---
title: Troubleshooting
description: Troubleshooting while waiting for help during beta / alpha testing
keywords: [reload, delete, manually, logs, server, console]
---

The Continue VS Code extension is currently in beta, and the JetBrains extension is in Alpha. If you are having trouble, please follow the steps below.

1. [Check the logs](#check-the-logs)
2. [Try the latest pre-release](#download-the-latest-pre-release)
3. [Download an older version](#download-an-older-version)
4. [Resolve keyboard shortcut issues](#keyboard-shortcuts-not-resolving)
5. [Check FAQs for common issues](#faqs)

## Check the logs

To solve many problems, the first step is reading the logs to find the relevant error message. To do this, follow these steps:

### VS Code

#### Console logs

:::info
In order to view debug logs, which contain extra information, click the dropdown at the top that says "Default levels" and select "Verbose".
:::

1. `cmd+shift+p` (MacOS) / `ctrl+shift+p` (Windows)
2. Search for and then select "Developer: Toggle Developer Tools"
3. This will open the [Chrome DevTools window](https://developer.chrome.com/docs/devtools/)
4. Select the `Console` tab
5. Read the console logs

#### LLM prompt logs

If you're getting a response from the LLM that doesn't seem to make sense, you can

1. Open the "Output" panel (right next to the terminal)
2. In the dropdown, select "Continue - LLM Prompts/Completions"
3. View the exact prompts that were sent to the LLM and the completions recieved

### JetBrains

Open `~/.continue/logs/core.log` to view the logs for the Continue plugin. The most recent logs are found at the bottom of the file.

Some JetBrains-related logs may also be found by clicking "Help" > "Show Log in Explorer/Finder".

## Download the latest pre-release

### VS Code

We are constantly making fixes and improvements to Continue, but the latest changes remain in a "pre-release" version for roughly a week so that we can test their stability. If you are experiencing issues, you can try the pre-release by going to the Continue extension page in VS Code and selecting "Switch to Pre-Release" as shown below.

![Pre-Release](../static/img/prerelease.png)

### JetBrains

On JetBrains, the "pre-release" happens through their Early Access Program (EAP) channel. To download the latest EAP version, enable the EAP channel:

1. Open JetBrains settings (`cmd/ctrl + ,`) and go to "Plugins"
2. Click the gear icon at the top
3. Select "Manage Plugin Repositories..."
4. Add "[https://plugins.jetbrains.com/plugins/eap/list](https://plugins.jetbrains.com/plugins/eap/list)" to the list
5. You'll now always be able to download the latest EAP version from the marketplace

## Download an Older Version

If you've tried everything, reported an error, know that a previous version was working for you, and are waiting to hear back, you can try downloading an older version of the extension.

For VS Code, All versions are hosted on the Open VSX Registry [here](https://open-vsx.org/extension/Continue/continue). Once you've downloaded the extension, which will be a .vsix file, you can install it manually by following the instructions [here](https://code.visualstudio.com/docs/editor/extension-gallery#_install-from-a-vsix).

You can find older versions of the JetBrains extension on their [marketplace](https://plugins.jetbrains.com/plugin/22707-continue), which will walk you through installing from disk.

## Keyboard shortcuts not resolving

If your keyboard shortcuts are not resolving, you may have other commands that are taking precedence over the Continue shortcuts. You can see if this is the case, and change your shortcut mappings, in the configuration of your IDE.

- [VSCode keyboard shortcuts docs](https://code.visualstudio.com/docs/getstarted/keybindings)
- [IntelliJ keyboard shortcut docs](https://www.jetbrains.com/help/idea/configuring-keyboard-and-mouse-shortcuts.html)

## FAQs

### Networking Issues

#### Configure Certificates

If you're seeing a `fetch failed` error and your network requires custom certificates, you will need to configure them in `config.json`. In each of the objects in the `"models"` array, add `requestOptions.caBundlePath` like this:

```json
{
  "models": [
    {
      "title": "My Model",
      ...
      "requestOptions": {
        "caBundlePath": "/path/to/cert.pem"
      }
    }
  ],
  ...
}
```

You may also set `requestOptions.caBundlePath` to an array of paths to multiple certificates.

#### VS Code Proxy Settings

If you are using VS Code and require requests to be made through a proxy, you are likely already set up through VS Code's [Proxy Server Support](https://code.visualstudio.com/docs/setup/network#_proxy-server-support). To double-check that this is enabled, use cmd/ctrl+, to open settings and search for "Proxy Support". Unless it is set to "off", then VS Code is responsible for making the request to the proxy.

#### code-server

Continue can be used in [code-server](https://coder.com/), but if you are running across an error in the logs that includes "This is likely because the editor is not running in a secure context", please see [their documentation on securely exposing code-server](https://coder.com/docs/code-server/latest/guide#expose-code-server).

### I installed Continue, but don't see the sidebar window

By default the Continue window is on the left side of VS Code, but it can be dragged to right side as well, which we recommend in our tutorial. In the situation where you have previously installed Continue and moved it to the right side, it may still be there. You can reveal Continue either by using cmd/ctrl+L or by clicking the button in the top right of VS Code to open the right sidebar.

### I'm getting a 404 error from OpenAI

If you have entered a valid API key and model, but are still getting a 404 error from OpenAI, this may be because you need to add credits to your billing account. You can do so from the [billing console](https://platform.openai.com/settings/organization/billing/overview). If you just want to check that this is in fact the cause of the error, you can try adding $1 to your account and checking whether the error persists.

### Indexing issues

If you are having persistent errors with indexing, our recommendation is to rebuild your index from scratch. Note that for large codebases this may take some time.

This can be accomplished using the following command: `Continue: Rebuild codebase index`.

### Android Studio - "Nothing to show" in Chat

This can be fixed by selecting `Actions > Choose Boot runtime for the IDE` then selecting the latest version, and then restarting Android Studio. [See this thread](https://github.com/continuedev/continue/issues/596#issuecomment-1789327178) for details.

## Still having trouble?

You can also join our Discord community [here](https://discord.gg/vapESyrFmJ) for additional support and discussions. Alternatively, you can create a GitHub issue [here](https://github.com/continuedev/continue/issues/new?assignees=&labels=bug&projects=&template=bug-report-%F0%9F%90%9B.md&title=), providing details of your problem, and we'll be able to help you out more quickly.
