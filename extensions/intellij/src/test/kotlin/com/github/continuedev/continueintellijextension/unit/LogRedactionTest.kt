package com.github.continuedev.continueintellijextension.unit

import com.github.continuedev.continueintellijextension.`continue`.process.LogRedaction
import junit.framework.TestCase

class LogRedactionTest : TestCase() {

    fun `test secret messages are omitted in both directions`() {
        val write = """{"messageId":"1","messageType":"writeSecrets","data":{"secrets":{"K":"sk-secret-value"}}}"""
        val read = """{"messageId":"2","messageType":"readSecrets","data":{"K":"sk-secret-value"}}"""
        val setup = """{"messageId":"3","messageType":"config/setSecret","data":{"secretName":"K","value":"sk-secret-value"}}"""
        for (line in listOf(write, read, setup)) {
            assertFalse(LogRedaction.forLog(line).contains("sk-secret-value"))
        }
        assertEquals("<writeSecrets message omitted>", LogRedaction.forLog(write))
    }

    fun `test the saved models request is omitted because it can carry an inline key`() {
        val line = """{"messageId":"4","messageType":"config/saveProviderModels","data":{"key":{"value":"sk-secret-value"}}}"""
        assertFalse(LogRedaction.forLog(line).contains("sk-secret-value"))
    }

    fun `test other messages are logged as they are`() {
        val line = """{"messageId":"5","messageType":"readFile","data":{"filepath":"file:///a"}}"""
        assertEquals(line, LogRedaction.forLog(line))
    }
}
