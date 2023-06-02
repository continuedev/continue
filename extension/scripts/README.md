# Scripts

Whenever we need python to run on the client side, we include a script file at the top level of this folder. All other files that are not to be run directly as a script (utility files) should be in a subfolder of `scripts`. You can call one of these scripts from the VS Code extension using the `runPythonScript` function in `bridge.ts`.

When the extension is activated (`activate` function in `src/extension.ts`), we call `setupPythonEnv`, which makes the virtual environment and downloads all the necessary requirements as given in `requirements.txt`. With this in mind, be sure to run `pip freeze > requirements.txt` whenever you add a new requirement.
