package com.github.continuedev.continueintellijextension.`continue`

import com.github.continuedev.continueintellijextension.constants.getSessionFilePath
import com.github.continuedev.continueintellijextension.constants.getSessionsListPath
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.io.File
import java.io.FileReader
import java.io.FileWriter
import java.lang.reflect.Type

typealias PersistedSessionInfo = MutableMap<String, Any>
typealias SessionInfo = MutableMap<String, Any>

class HistoryManager {
    private val gson = Gson()

    fun list(): List<PersistedSessionInfo> {
        val filePath = getSessionsListPath()
        val file = File(filePath)

        if (!file.exists()) {
            return emptyList()
        }

        val reader = FileReader(file)
        val type: Type = object : TypeToken<List<PersistedSessionInfo>>() {}.type
        val sessions = gson.fromJson<List<PersistedSessionInfo>>(reader, type)

        return sessions.filter { it["sessionId"] != null }
    }

    fun delete(sessionId: String) {
        val sessionFile = getSessionFilePath(sessionId)
        val file = File(sessionFile)

        if (!file.exists()) {
            throw Exception("Session file $sessionFile does not exist")
        }

        file.delete()
        val sessionsListFile = getSessionsListPath()
        val sessionsListRaw = FileReader(File(sessionsListFile))

        val type: Type = object : TypeToken<List<SessionInfo>>() {}.type
        var sessionsList = gson.fromJson<List<SessionInfo>>(sessionsListRaw, type)

        sessionsList = sessionsList.filter { it["sessionId"] != sessionId }

        val writer = FileWriter(sessionsListFile)
        gson.toJson(sessionsList, writer)
        writer.close()
    }

    fun load(sessionId: String): PersistedSessionInfo {
        val sessionFile = getSessionFilePath(sessionId)
        val file = File(sessionFile)

        if (!file.exists()) {
            throw Exception("Session file $sessionFile does not exist")
        }

        val reader = FileReader(file)
        val text = reader.readText()
        val type: Type = object : TypeToken<MutableMap<String, Any>>() {}.type
        val session = gson.fromJson<MutableMap<String, Any>>(text, type)
        session["sessionId"] = sessionId
        return session
    }

    fun save(session: PersistedSessionInfo) {
        val writer = FileWriter(getSessionFilePath(session["sessionId"] as String? ?: uuid()))
        gson.toJson(session, writer)
        writer.close()

        val sessionsListFilePath = getSessionsListPath()
        val rawSessionsList = FileReader(File(sessionsListFilePath))

        val type: Type = object : TypeToken<List<SessionInfo>>() {}.type
        val sessionsList = gson.fromJson<List<MutableMap<String, Any>>>(rawSessionsList, type).toMutableList()

        var found = false
        for (sessionInfo in sessionsList) {
            if (sessionInfo["sessionId"] == session["sessionId"]) {
                sessionInfo["title"] = session["title"] as Any
                sessionInfo["workspaceDirectory"] = session["workspaceDirectory"] as Any
                sessionInfo["dateCreated"] = System.currentTimeMillis().toString()
                found = true
                break
            }
        }

        if (!found) {
            val sessionInfo = mutableMapOf(
                "sessionId" to session["sessionId"],
                "title" to session["title"],
                "dateCreated" to System.currentTimeMillis().toString(),
                "workspaceDirectory" to session["workspaceDirectory"]
            ) as MutableMap<String, Any>
            sessionsList.add(sessionInfo)
        }

        val writerList = FileWriter(sessionsListFilePath)
        gson.toJson(sessionsList, writerList)
        writerList.close()
    }
}
