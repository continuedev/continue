# Run from extensions/vscode/scripts directory

import os
import subprocess


def run(cmd, suppress_errors=False):
    return subprocess.run(cmd, shell=True, capture_output=suppress_errors)


def remove_existing_vsix_files(build_directory):
    # Ensure build directory exists
    if not os.path.exists(build_directory):
        os.mkdir(build_directory)
    for filename in os.listdir(build_directory):
        if filename.endswith(".vsix"):
            file_path = os.path.join(build_directory, filename)
            os.remove(file_path)


def return_vsix(build_directory):
    vsix_files = [
        filename
        for filename in os.listdir(build_directory)
        if filename.endswith(".vsix")
    ]
    return os.path.join(build_directory, vsix_files[0])


def main():
    # Clear out old stuff
    build_directory = "../build"
    remove_existing_vsix_files(build_directory)
    run("rm ../server/continuedev-0.1.2-py3-none-any.whl", True)

    # Check for Python and Node - we won't install them, but will warn
    resp1 = run("python --version")
    resp2 = run("python3 --version")
    if resp1.stderr and resp2.stderr:
        print(
            "Python is required for Continue but is not installed on your machine. See https://www.python.org/downloads/ to download the latest version, then try again."
        )
        return

    resp = run("node --version")
    if resp.stderr:
        print(
            "Node is required for Continue but is not installed on your machine. See https://nodejs.org/en/download/ to download the latest version, then try again."
        )
        return

    resp = run("npm --version")
    if resp.stderr:
        print(
            "NPM is required for Continue but is not installed on your machine. See https://nodejs.org/en/download/ to download the latest version, then try again."
        )
        return

    resp = run("poetry --version")
    if resp.stderr:
        print(
            "Poetry is required for Continue but is not installed on your machine. See https://python-poetry.org/docs/#installation to download the latest version, then try again."
        )
        return

    editor_cmd = None
    editor_name = None
    for cmd, editor in [("code", "VSCode"), ("codium", "VSCodium")]:
        resp = run(f"{cmd} --version", True)
        if resp.returncode == 0:
            print(f"{editor} version {resp.stdout.decode()}")
            editor_cmd = cmd
            editor_name = editor
            break

    if not editor_cmd:
        print(
            "No code editor command is available. Please install a code editor and try again."
        )
        return

    resp = run("cd ../../continuedev; poetry install; poetry run typegen")

    resp = run(
        "cd ../../..; npm i; cd gui; npm i; cd ../extensions/vscode; npm run package"
    )

    if resp.stderr:
        print("Error packaging the extension. Please try again.")
        print("This was the error: ", resp.stderr)
        return

    run(
        f"NODE_OPTIONS='--no-warnings' {editor_cmd} --install-extension {return_vsix(build_directory)}"
    )
    print(
        f"Continue extension installed successfully in {editor_name}. Please restart your editor to use it."
    )


if __name__ == "__main__":
    main()
