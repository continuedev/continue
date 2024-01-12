package com.github.continuedev.continueintellijextension.constants

import java.io.File
import java.nio.file.Files
import java.nio.file.Paths

const val DEFAULT_CONFIG = """
{
  "models": [
    {
      "title": "GPT-4",
      "provider": "free-trial",
      "model": "gpt-4"
    },
    {
      "title": "GPT-3.5-Turbo",
      "provider": "free-trial",
      "model": "gpt-3.5-turbo"
    },
    {
      "title": "Phind CodeLlama",
      "provider": "free-trial",
      "model": "phind-codellama-34b"
    },
    {
      "title": "Gemini Pro",
      "provider": "free-trial",
      "model": "gemini-pro"
    }
  ],
  "slashCommands": [
    {
      "name": "edit",
      "description": "Edit highlighted code",
      "step": "EditHighlightedCodeStep"
    },
    {
      "name": "comment",
      "description": "Write comments for the highlighted code",
      "step": "CommentCodeStep"
    },
    {
      "name": "share",
      "description": "Download and share this session",
      "step": "ShareSessionStep"
    },
    {
      "name": "cmd",
      "description": "Generate a shell command",
      "step": "GenerateShellCommandStep"
    }
  ],
  "customCommands": [
    {
      "name": "test",
      "prompt": "Write a comprehensive set of unit tests for the selected code. It should setup, run tests that check for correctness including important edge cases, and teardown. Ensure that the tests are complete and sophisticated. Give the tests just as chat output, don't edit any file.",
      "description": "Write unit tests for highlighted code"
    }
  ],
  "contextProviders": [
    { "name": "diff", "params": {} },
    {
      "name": "open",
      "params": {}
    },
    { "name": "terminal", "params": {} }
  ]
}
"""

const val DEFAULT_CONFIG_JS = """
function modifyConfig(config) {
  return config;
}
export {
  modifyConfig
};
"""

fun getContinueGlobalPath(): String {
    val continuePath = Paths.get(System.getProperty("user.home"), ".continue")
    if (Files.notExists(continuePath)) {
        Files.createDirectories(continuePath)
    }
    return continuePath.toString()
}

fun getConfigJsonPath(): String {
    val path = Paths.get(getContinueGlobalPath(), "config.json")
    if (Files.notExists(path)) {
        Files.createFile(path)
        Files.writeString(path, DEFAULT_CONFIG);
    }
    return path.toString()
}

fun getConfigJsPath(): String {
    val path = Paths.get(getContinueGlobalPath(), "config.js")
    if (Files.notExists(path)) {
        Files.createFile(path)
        Files.writeString(path, DEFAULT_CONFIG_JS);
    }
    return path.toString()
}

fun getSessionsDir(): String {
    val path = Paths.get(getContinueGlobalPath(), "sessions")
    if (Files.notExists(path)) {
        Files.createDirectories(path)
    }
    return path.toString()
}

fun getSessionsListPath(): String {
    val path = Paths.get(getSessionsDir(),  "sessions.json")
    if (Files.notExists(path)) {
        Files.createFile(path)
        Files.writeString(path, "[]");
    }
    return path.toString()
}

fun getSessionFilePath(sessionId: String): String {
    val path = Paths.get(getSessionsDir(),  "$sessionId.json")
    if (Files.notExists(path)) {
        Files.createFile(path)
        Files.writeString(path, "{}");
    }
    return path.toString()
}

fun devDataPath(): String {
    val path = Paths.get(getContinueGlobalPath(), "dev_data")
    if (Files.notExists(path)) {
        Files.createDirectories(path)
    }
    return path.toString()
}

fun getDevDataFilepath(filename: String): String {
    val path = Paths.get(devDataPath(), filename)
    if (Files.notExists(path)) {
        Files.createFile(path)
    }
    return path.toString()
}

fun getMigrationsFolderPath(): String {
    val path = Paths.get(getContinueGlobalPath(), ".migrations")
    if (Files.notExists(path)) {
        Files.createDirectories(path)
    }
    return path.toString()
}

fun migrate(id: String, callback: () -> Unit) {
    val migrationsPath = getMigrationsFolderPath()
    val migrationPath = Paths.get(migrationsPath, id).toString()
    val migrationFile = File(migrationPath)
    if (!migrationFile.exists()) {
        migrationFile.writeText("")
        callback()
    }
}