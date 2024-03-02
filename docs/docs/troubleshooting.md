---
title: ❓ Troubleshooting
description: Troubleshooting while waiting for help during beta / alpha testing
keywords: [reload, delete, manually, logs, server, console]
---

# ❓ Troubleshooting

The Continue VS Code extension is currently in beta, and the Intellij extension is in Alpha. If you are having trouble, please follow the steps below.

## Check the console logs (VS Code)

To solve many problems, the first step is reading the logs to find the relevant error message. To do this, follow these steps:

1. `cmd+shift+p` (MacOS) / `ctrl+shift+p` (Windows)
2. Search for and then select "Developer: Toggle Developer Tools"
3. This will open the [Chrome DevTools window](https://developer.chrome.com/docs/devtools/)
4. Select the `Console` tab
5. Read the console logs

## Configure Certificates

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

## Upgrade VS Code Version

Continue is built against Node.js version 19.0.0 and may not be compatible with older versions of Node. If the extension completely fails to load (e.g. pressing ctrl/cmd+L causes a warning that the command does not exist, and the sidebar does not load), you may want to try upgrading VS Code to the latest version.

## Android Studio - JCEF Not Supported

Certain versions of Android Studio, unlike other JetBrains IDEs, do not by default support the Java Chromium Embedded Framework, which is required for Continue's web-based sidebar. If you see an error saying that JCEF failed to initialize, you may be able to solve the problem by [changing your boot runtime](https://github.com/continuedev/continue/issues/596#issuecomment-1789327178).

## Download a Newer Version

If you are using an older version of the Continue extension, particularly one which depends on the separate Python server, we would recommend downloading the latest version of the extension, as we are constantly making bug fixes and are likely to have solved any major issues.

## Download an Older Version

If you've tried everything, reported an error, know that a previous version was working for you, and are waiting to hear back, you can try downloading an older version of the extension.

For VS Code, All versions are hosted on the Open VSX Registry [here](https://open-vsx.org/extension/Continue/continue). Once you've downloaded the extension, which will be a .vsix file, you can install it manually by following the instructions [here](https://code.visualstudio.com/docs/editor/extension-gallery#_install-from-a-vsix).

You can find older versions of the JetBrains extension on their [marketplace](https://plugins.jetbrains.com/plugin/22707-continue), which will walk you through installing from disk.

## Still having trouble?

Create a GitHub issue [here](https://github.com/continuedev/continue/issues/new?assignees=&labels=bug&projects=&template=bug-report-%F0%9F%90%9B.md&title=), leaving the details of your problem, and we'll be able to more quickly help you out.
