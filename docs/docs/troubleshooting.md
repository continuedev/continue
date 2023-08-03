# Troubleshooting

The Continue VS Code extension is currently in beta. It will attempt to start the Continue Python server locally for you, but sometimes this will fail, causing the "Starting Continue server..." not to disappear, or other hangups. While we are working on fixes to all of these problems, there are a few things you can do to temporarily troubleshoot:

## For Windows Users

In order to activate the Continue virtual environment, you must enable running scripts in PowerShell. In this case, the following error will appear in the console:

> A Python virtual enviroment cannot be activated because running scripts is disabled for this user. In order to use Continue, please enable signed scripts to run with this command in PowerShell: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`, reload VS Code, and then try again.

Please open PowerShell, run the command (`Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`), and reload VS Code.

## For Linux Users

Linux does not come pre-installed with `python3-venv`, which is needed for Continue to donwload dependencies and run the local server. If you see a related error, you can solve by:

1. Checking your Python version with `python3 --version`
2. Update `apt-get` with `apt-get update`
3. Install the correct version of `python3-venv` by running `apt-get install python3.X-venv` (replacing `3.X` with your Python version. For example, if you saw "Python 3.11.4", this should be "3.11")
4. Reload VS Code

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

## Python requirement

Continue requires that you have Python 3.8 or greater. You can check what version you have by running either `python3 --version` or `python --version` from a terminal.  If the version is not 3.8.x or higher, please [install](https://python.org) it

## Still having trouble?

Create a GitHub issue [here](https://github.com/continuedev/continue/issues/new?assignees=&labels=bug&projects=&template=bug-report-%F0%9F%90%9B.md&title=), leaving the details of your problem, and we'll be able to more quickly help you out.
