# ❓ Troubleshooting

The Continue VS Code extension is currently in beta, and the Intellij extension is in Alpha. They will attempt to start the Continue Python server locally for you, but sometimes this will fail, causing the "Starting Continue server..." not to disappear, or other hangups. While we are working on fixes to all of these problems, there are a few things you can do to temporarily troubleshoot:

## Reload your editor

#### Intellij

Close out the window and re-open the project. This will give Continue another chance to start the server.

#### VS Code

Open the command palette with cmd+shift+p, then type "Reload Window" and select it. This will give Continue another chance to start the server.

## Kill the existing server

If the above doesn't work, you can try to kill the server manually before reloading.

1. Open any terminal
2. Enter `lsof -i :65432 | grep "(LISTEN)" | awk '{print $2}' | xargs kill -9` to kill the server running on port 65432.
3. Restart your IDE and Continue will attempt to start a fresh server.

## Delete `~/.continue`

To get a completely fresh install of Continue, you can delete the `~/.continue` directory. Note that this will delete your config file and all saved sessions and development data.

## Run the server manually

If none of these work, you can start the server yourself as is explained here: [Running the Continue server manually](./walkthroughs/manually-run-continue.md).

This may be necessary if you have a firewall blocking the server from downloading, are on an air-gapped computer, or are on an OS where the server binary fails to run (e.g. RHEL8).

## Check the server logs

#### Intellij

Open the file `~/.continue/continue.log` where you can view the latest logs at the bottom.

#### VS Code

1. `cmd+shift+p` (MacOS) / `ctrl+shift+p` (Windows)
2. Search for and then select "Continue: View Continue Server Logs"
3. Read the `continue.log` file that has opened

## Check the console logs (VS Code)

If your Continue server is not setting up, try checking the console logs:

1. `cmd+shift+p` (MacOS) / `ctrl+shift+p` (Windows)
2. Search for and then select "Developer: Toggle Developer Tools"
3. This will open the [Chrome DevTools window](https://developer.chrome.com/docs/devtools/)
4. Select the `Console` tab
5. Read the console logs

## Problems with Meilisearch

If you have checked the logs and the problem seems related to Meilisearch, or if context providers aren't working, you can try to manually setup Meilisearch with their instructions [here](https://www.meilisearch.com/docs/learn/getting_started/installation). Once downloaded, you should place the Meilisearch binary at `~/.continue/server/meilisearch` and start it. Once it is running on port 7700, Continue will be able to automatically connect.

## Download an Older Version (VS Code)

If you've tried everything, reported an error, and are waiting to hear back, you can try downloading an older version of the extension. All versions are hosted on the Open VSX Registry [here](https://open-vsx.org/extension/Continue/continue). Once you've downloaded the extension, which will be a .vsix file, you can install it manually by following the instructions [here](https://code.visualstudio.com/docs/editor/extension-gallery#_install-from-a-vsix).

## Still having trouble?

Create a GitHub issue [here](https://github.com/continuedev/continue/issues/new?assignees=&labels=bug&projects=&template=bug-report-%F0%9F%90%9B.md&title=), leaving the details of your problem, and we'll be able to more quickly help you out.
