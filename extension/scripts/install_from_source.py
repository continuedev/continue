import os
import subprocess


def run(cmd: str):
    return subprocess.run(cmd, shell=True, capture_output=False)


def main():
    # Check for Python and Node - we won't install them, but will warn
    resp1 = run("python --version")
    resp2 = run("python3 --version")
    if resp1.stderr and resp2.stderr:
        print("Python is required for Continue but is not installed on your machine. See https://www.python.org/downloads/ to download the latest version, then try again.")
        return

    resp = run("node --version")
    if resp.stderr:
        print("Node is required for Continue but is not installed on your machine. See https://nodejs.org/en/download/ to download the latest version, then try again.")
        return

    resp = run("npm --version")
    if resp.stderr:
        print("NPM is required for Continue but is not installed on your machine. See https://nodejs.org/en/download/ to download the latest version, then try again.")
        return

    resp = run("poetry --version")
    if resp.stderr:
        print("Poetry is required for Continue but is not installed on your machine. See https://python-poetry.org/docs/#installation to download the latest version, then try again.")
        return

    resp = run("cd ../../continuedev; poetry run typegen")

    resp = run(
        "cd ..; npm i; cd react-app; npm i; cd ..; npm run full-package")

    if resp.stderr:
        print("Error packaging the extension. Please try again.")
        print("This was the error: ", resp.stderr)
        return

    latest = None
    latest_major = 0
    latest_minor = 0
    latest_patch = 0
    for file in os.listdir("../build"):
        if file.endswith(".vsix"):
            version = file.split("-")[1].split(".vsix")[0]
            major, minor, patch = list(
                map(lambda x: int(x), version.split(".")))
            if latest is None or (major >= latest_major and minor >= latest_minor and patch > latest_patch):
                latest = file
                latest_major = major
                latest_minor = minor
                latest_patch = patch

    resp = run(f"cd ..; code --install-extension ./build/{latest}")

    print("Continue VS Code extension installed successfully. Please restart VS Code to use it.")


if __name__ == "__main__":
    main()
