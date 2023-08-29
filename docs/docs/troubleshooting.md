# Troubleshooting

The Continue VS Code extension is currently in beta. It will attempt to start the Continue Python server locally for you, but sometimes this will fail, causing the "Starting Continue server..." not to disappear, or other hangups. While we are working on fixes to all of these problems, there are a few things you can do to temporarily troubleshoot:

## Reload VS Code

Open the command palette with cmd+shift+p, then type "Reload Window" and select it. This will give Continue another chance to start the server.

## Kill the existing server

If the above doesn't work, you can try to kill the server manually before reloading.

1. Open any terminal
2. Enter `lsof -i :65432 | grep "(LISTEN)" | awk '{print $2}' | xargs kill -9` to kill the server running on port 65432.
3. Restart VS Code, and Continue will attempt to start a fresh server.

## Delete `~/.continue`

To get a completely fresh install of Continue, you can delete the `~/.continue` directory. Note that this will delete your config file and all saved sessions and development data.

## Run the server manually

If none of these work, you can start the server yourself as is explained here: [Running the Continue server manually](https://continue.dev/docs/how-continue-works)

## Manually download the server binary

Continue runs a Python server locally on your machine, but packages it as a binary using pyinstaller to avoid dependency issues. The corresponding binary for your operating system is downloaded when you first install the extension, but if you are in an air-gapped environment, or are otherwise having trouble setting up, you can manually download the binary from our S3 bucket. These are the download links for each OS:

- [MacOS (Intel)](https://continue-server-binaries.s3.us-west-1.amazonaws.com/mac/run)
- [MacOS (Apple Silicon)](https://continue-server-binaries.s3.us-west-1.amazonaws.com/apple-silicon/run)
- [Windows](https://continue-server-binaries.s3.us-west-1.amazonaws.com/windows/run.exe)
- [Linux](https://continue-server-binaries.s3.us-west-1.amazonaws.com/linux/run)

Once downloaded, start the binary by running `./run` (MacOS/Linux) or `./run.exe` (Windows) in the directory where you downloaded it. You should see that it begins listening on port 65432.

> Important: Continue checks to see if an old version of the binary is running. If so, it will kill the process. To avoid this, you should update the contents of `~/.continue/server/server_version.txt` to match your current Continue extension version (e.g. "0.0.1"). This will prevent the extension from killing the server you just started. Once this is done, you can reload the VS Code window and Continue should connect.

## Check the server logs

1. `cmd+shift+p` (MacOS) / `ctrl+shift+p` (Windows)
2. Search for and then select "Developer: Toggle Developer Tools"
3. Read the `continue.log` file that has opened

## Check the console logs

If your Continue server is not setting up, try checking the console logs:

1. `cmd+shift+p` (MacOS) / `ctrl+shift+p` (Windows)
2. Search for and then select "Developer: Toggle Developer Tools"
3. Select `Console`
4. Read the console logs

## Meilisearch on Windows

As of now Windows users must manually download and start Meilisearch to use the '@' context referencing feature. To do so, follow the instructions here: https://www.meilisearch.com/docs/learn/getting_started/installation. Alternatively, you can track our progress on support for Meilisearch on Windows here: https://github.com/continuedev/continue/issues/408. Once Meilisearch is up and running on http://localhost:7700, Continue should be able to automatically connect. You may just have to reload the VS Code window first.

## Still having trouble?

Create a GitHub issue [here](https://github.com/continuedev/continue/issues/new?assignees=&labels=bug&projects=&template=bug-report-%F0%9F%90%9B.md&title=), leaving the details of your problem, and we'll be able to more quickly help you out.
