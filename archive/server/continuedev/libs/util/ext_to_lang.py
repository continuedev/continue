ext_dict = {
    "py": "python",
    "js": "javascript",
    "ts": "typescript",
    "java": "java",
    "go": "go",
    "rb": "ruby",
    "rs": "rust",
    "c": "c",
    "cpp": "cpp",
    "cs": "csharp",
    "php": "php",
    "scala": "scala",
    "swift": "swift",
    "kt": "kotlin",
    "md": "markdown",
    "json": "json",
    "html": "html",
    "css": "css",
    "sh": "shell",
    "yaml": "yaml",
    "toml": "toml",
    "tex": "latex",
    "sql": "sql",
}


def ext_to_lang(ext: str) -> str:
    return ext_dict.get(ext, "plaintext")
