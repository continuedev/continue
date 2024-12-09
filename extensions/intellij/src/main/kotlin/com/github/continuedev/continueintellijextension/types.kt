package com.github.continuedev.continueintellijextension

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable


// Enums and basic types

@Serializable
enum class IdeType {
    @SerialName("jetbrains")
    JETBRAINS,
    @SerialName("vscode")
    VSCODE;
}

enum class DiffLineType {
    NEW,
    OLD,
    SAME
}

enum class DiffLine {
  type: DiffLineType,
  line: string;
}

enum class ToastType {
    INFO,
    ERROR,
    WARNING
}

enum class FileType(val value: Int) {
    UNKNOWN(0),
    FILE(1),
    DIRECTORY(2),
    SYMBOLIC_LINK(64)
}

enum class ConfigMergeType {
    MERGE,
    OVERWRITE
}

// Data classes for basic types

data class Position(val line: Int, val character: Int)

data class Range(val start: Position, val end: Position)

data class IdeInfo(
    val ideType: IdeType,
    val name: String,
    val version: String,
    val remoteName: String,
    val extensionVersion: String
)

data class Problem(
    val filepath: String,
    val range: Range,
    val message: String
)

data class Thread(val name: String, val id: Int)

data class IndexTag(
    val artifactId: String,
    val branch: String,
    val directory: String
)

data class Location(
    val filepath: String,
    val position: Position
)

data class RangeInFile(
    val filepath: String,
    val range: Range
)

data class CurrentFile(
    val isUntitled: Boolean,
    val path: String,
    val contents: String
)

data class ControlPlaneSessionInfo(
    val accessToken: String,
    val account: Account
)

data class Account(
    val label: String,
    val id: String
)

data class IdeSettings(
    val remoteConfigServerUrl: String?,
    val remoteConfigSyncPeriod: Int,
    val userToken: String,
    val enableControlServerBeta: Boolean,
    val pauseCodebaseIndexOnStart: Boolean,
    val enableDebugLogs: Boolean
)

data class ContinueRcJson(
    val mergeBehavior: ConfigMergeType
    // Add other optional fields as needed
)

data class DirEntry(val name: String, val type: FileType)