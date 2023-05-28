import subprocess


def run(cmd: str):
    return subprocess.run(cmd, shell=True, capture_output=True)


def main():
    # Check for Python and Node - we won't install them, but will warn
    out, err1 = run("python --version")
    out, err2 = run("python3 --version")
    if err1 and err2:
        print("Python is required for Continue but is not installed on your machine. See https://www.python.org/downloads/ to download the latest version, then try again.")
        return

    out, err = run("node --version")
    if err:
        print("Node is required for Continue but is not installed on your machine. See https://nodejs.org/en/download/ to download the latest version, then try again.")
        return

    out, err = run("npm --version")
    if err:
        print("NPM is required for Continue but is not installed on your machine. See https://nodejs.org/en/download/ to download the latest version, then try again.")
        return

    out, err = run("poetry --version")
    if err:
        print("Poetry is required for Continue but is not installed on your machine. See https://python-poetry.org/docs/#installation to download the latest version, then try again.")
        return

    out, err = run("cd ../../continuedev; poetry run typegen")

    out, err = run(
        "cd ..; npm i; cd react-app; npm i; cd ..; npm run full-package\r y\r npm run install-extension")

    if err:
        print("Error installing the extension. Please try again.")
        print("This was the error: ", err)
        return

    print("Continue VS Code extension installed successfully. Please restart VS Code to use it.")


if __name__ == "__main__":
    main()
