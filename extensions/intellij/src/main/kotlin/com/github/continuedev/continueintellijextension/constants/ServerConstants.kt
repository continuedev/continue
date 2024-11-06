/**
 * Note: This file is out of sync with the contents of core/util/paths.ts, which we use in VS Code.
 * This is potentially causing JetBrains specific bugs.
 */
package com.github.continuedev.continueintellijextension.constants

import java.nio.file.Files
import java.nio.file.Paths

// Uncertain if this is being used anywhere since we also attempt to write a default config in
// core/util/paths.ts
const val DEFAULT_CONFIG =
    """
{
  "models": [
    {
      "title": "Jarvis Go",
      "model": "sammcj/llama-3-1-8b-smcleod-golang-coder-v3:Q8_0",
      "provider": "ollama",
      "apiBase": "http://localhost:11434",
      "contextLength": 8192
    }
  ],
  "tabAutocompleteModel": {
    "title": "Jarvis Go",
    "model": "sammcj/llama-3-1-8b-smcleod-golang-coder-v3:Q8_0",
    "provider": "ollama",
    "apiBase": "http://localhost:11434",
    "contextLength": 8192
  },
  "customCommands": [
    {
      "name": "test",
      "prompt": "{{{ input }}}\n\nWrite a comprehensive set of unit tests for the selected code. It should setup, run tests that check for correctness including important edge cases, and teardown. Ensure that the tests are complete and sophisticated. Give the tests just as chat output, don't edit any file.",
      "description": "Write unit tests for highlighted code"
    }
  ],
  "contextProviders": [
    {
      "name": "diff",
      "params": {}
    },
    {
      "name": "folder",
      "params": {}
    },
    {
      "name": "codebase",
      "params": {}
    },
    {
      "name": "open",
      "params": {}
    }
  ],
  "slashCommands": [
    {
      "name": "edit",
      "description": "Edit selected code"
    },
    {
      "name": "comment",
      "description": "Write comments for the selected code"
    },
    {
      "name": "review",
      "description": "Review my code"
    }
  ],
  "docs": []
}
"""

const val DEFAULT_CONFIG_JS =
    """
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

fun getContinueRemoteConfigPath(remoteHostname: String): String {
  val path = Paths.get(getContinueGlobalPath(), ".configs")
  if (Files.notExists(path)) {
    Files.createDirectories(path)
  }
  return Paths.get(path.toString(), remoteHostname).toString()
}

fun getConfigJsonPath(remoteHostname: String? = null): String {
  val path =
      Paths.get(
          if (remoteHostname != null) getContinueRemoteConfigPath(remoteHostname)
          else getContinueGlobalPath(),
          "config.json")
  if (Files.notExists(path)) {
    Files.createFile(path)
    Files.writeString(path, if (remoteHostname == null) DEFAULT_CONFIG else "{}")
  }
  return path.toString()
}

fun getConfigJsPath(remoteHostname: String? = null): String {
  val path =
      Paths.get(
          if (remoteHostname != null) getContinueRemoteConfigPath(remoteHostname)
          else getContinueGlobalPath(),
          "config.js")
  if (Files.notExists(path)) {
    Files.createFile(path)
    Files.writeString(path, DEFAULT_CONFIG_JS)
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
  val path = Paths.get(getSessionsDir(), "sessions.json")
  if (Files.notExists(path)) {
    Files.createFile(path)
    Files.writeString(path, "[]")
  }
  return path.toString()
}

fun getSessionFilePath(sessionId: String): String {
  val path = Paths.get(getSessionsDir(), "$sessionId.json")
  if (Files.notExists(path)) {
    Files.createFile(path)
    Files.writeString(path, "{}")
  }
  return path.toString()
}
