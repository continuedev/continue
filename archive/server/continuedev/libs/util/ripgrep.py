import os
import sys


def get_rg_path():
    if os.name == "nt":
        paths_to_try = [
            f"C:\\Users\\{os.getlogin()}\\AppData\\Local\\Programs\\Microsoft VS Code\\resources\\app\\node_modules.asar.unpacked\\@vscode\\ripgrep\\bin\\rg.exe",
            f"C:\\Users\\{os.getlogin()}\\AppData\\Local\\Programs\\Microsoft VS Code\\resources\\app\\node_modules.asar.unpacked\\vscode-ripgrep\\bin\\rg.exe",
        ]
        for path in paths_to_try:
            if os.path.exists(path):
                rg_path = path
                break
    elif os.name == "posix":
        if "darwin" in sys.platform:
            rg_path = "/Applications/Visual Studio Code.app/Contents/Resources/app/node_modules.asar.unpacked/@vscode/ripgrep/bin/rg"
        else:
            rg_path = "/usr/share/code/resources/app/node_modules.asar.unpacked/vscode-ripgrep/bin/rg"
    else:
        rg_path = "rg"

    if not os.path.exists(rg_path):
        rg_path = "rg"

    return rg_path
