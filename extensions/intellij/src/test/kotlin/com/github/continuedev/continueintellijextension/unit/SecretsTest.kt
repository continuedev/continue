package com.github.continuedev.continueintellijextension.unit

import com.github.continuedev.continueintellijextension.secrets.SecretStore
import com.github.continuedev.continueintellijextension.secrets.Secrets
import junit.framework.TestCase

class SecretsTest : TestCase() {

    private class MemoryStore : SecretStore {
        val values = mutableMapOf<String, String>()
        override fun get(key: String): String? = values[key]
        override fun set(key: String, value: String) {
            if (value.isEmpty()) values.remove(key) else values[key] = value
        }
    }

    fun `test a written value reads back`() {
        val store = MemoryStore()
        Secrets.write(store, mapOf("CONTINUED_ANTHROPIC_API_KEY" to "sk-ant-1"))
        assertEquals(
            mapOf("CONTINUED_ANTHROPIC_API_KEY" to "sk-ant-1"),
            Secrets.read(store, listOf("CONTINUED_ANTHROPIC_API_KEY"))
        )
    }

    // Core probes secure storage with a write and a read-back, so the probe must round-trip.
    fun `test the probe round-trips`() {
        val store = MemoryStore()
        Secrets.write(store, mapOf("continued.secretStorageProbe" to "ok"))
        assertEquals("ok", Secrets.read(store, listOf("continued.secretStorageProbe"))["continued.secretStorageProbe"])
    }

    fun `test missing and empty names are left out`() {
        val store = MemoryStore()
        Secrets.write(store, mapOf("A" to "1"))
        assertEquals(mapOf("A" to "1"), Secrets.read(store, listOf("A", "B")))
        Secrets.write(store, mapOf("A" to ""))
        assertEquals(emptyMap<String, String>(), Secrets.read(store, listOf("A")))
    }

    fun `test only the requested names are returned`() {
        val store = MemoryStore()
        Secrets.write(store, mapOf("A" to "1", "B" to "2"))
        assertEquals(mapOf("B" to "2"), Secrets.read(store, listOf("B")))
    }
}
