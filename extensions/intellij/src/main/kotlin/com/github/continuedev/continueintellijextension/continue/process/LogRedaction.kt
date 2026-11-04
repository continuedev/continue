package com.github.continuedev.continueintellijextension.`continue`.process

/**
 * Messages that carry API keys. Their lines are never written to the debug
 * log, in either direction (a request with a key, or the response to a read).
 */
object LogRedaction {

    private val SENSITIVE_MESSAGE_TYPES = setOf(
        "readSecrets",
        "writeSecrets",
        "config/setSecret",
        "config/saveProviderModels",
        "onboarding/complete",
    )

    private val MESSAGE_TYPE = Regex("\"messageType\"\\s*:\\s*\"([^\"]+)\"")

    /** [line] as it may be logged: the whole line is replaced for a sensitive message type. */
    fun forLog(line: String): String {
        val type = MESSAGE_TYPE.find(line)?.groupValues?.get(1)
        return if (type != null && type in SENSITIVE_MESSAGE_TYPES) "<$type message omitted>" else line
    }
}
