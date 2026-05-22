package com.github.continuedev.continueintellijextension.unit

import com.github.continuedev.continueintellijextension.browser.ContinueBrowser
import com.github.continuedev.continueintellijextension.browser.ContinueBrowser.Companion.buildChunkScripts
import junit.framework.TestCase
import java.util.Base64

class ContinueBrowserChunkTest : TestCase() {

    fun `test small message produces single chunk`() {
        val json = """{"messageType":"test","data":"hello"}"""
        val scripts = buildChunkScripts(json, "buf1")

        assertEquals(1, scripts.chunks.size)
        assertReassemblesTo(json, scripts.chunks, "buf1")
    }

    fun `test message splits into expected number of chunks`() {
        val json = """{"data":"${"x".repeat(2_000_000)}"}"""
        val chunkSize = ContinueBrowser.CHUNK_SIZE
        val encoded = Base64.getEncoder().encodeToString(json.toByteArray(Charsets.UTF_8))
        val expectedChunks = (encoded.length + chunkSize - 1) / chunkSize

        val scripts = buildChunkScripts(json, "buf2")

        assertEquals(expectedChunks, scripts.chunks.size)
        assertReassemblesTo(json, scripts.chunks, "buf2")
    }

    fun `test custom chunk size`() {
        val json = """{"data":"${"a".repeat(100)}"}"""
        val scripts = buildChunkScripts(json, "buf3", chunkSize = 32)

        assertTrue(scripts.chunks.size > 1)
        assertReassemblesTo(json, scripts.chunks, "buf3")
    }

    fun `test init script creates array buffer`() {
        val scripts = buildChunkScripts("{}", "myId")
        assertEquals("""window.__cc=window.__cc||{};window.__cc["myId"]=[];""", scripts.init)
    }

    fun `test finalize script joins and decodes`() {
        val scripts = buildChunkScripts("{}", "myId")
        assertTrue(scripts.finalize.contains("""window.__cc["myId"].join("")"""))
        assertTrue(scripts.finalize.contains("atob"))
        assertTrue(scripts.finalize.contains("TextDecoder"))
        assertTrue(scripts.finalize.contains("JSON.parse"))
        assertTrue(scripts.finalize.contains("""delete window.__cc["myId"]"""))
    }

    fun `test cleanup script deletes buffer`() {
        val scripts = buildChunkScripts("{}", "myId")
        assertEquals("""delete window.__cc["myId"];""", scripts.cleanup)
    }

    fun `test special characters survive base64 round-trip`() {
        val json = """{"data":"héllo wörld 日本語 emoji: 🎉 quotes: \"nested\""}"""
        val scripts = buildChunkScripts(json, "buf4", chunkSize = 32)

        assertReassemblesTo(json, scripts.chunks, "buf4")
    }

    fun `test exact chunk boundary`() {
        // Create a JSON string whose Base64 encoding is exactly 2x chunkSize
        val chunkSize = 64
        val target = chunkSize * 2
        // Base64 output is ceil(input/3)*4, so we need input = target * 3 / 4 bytes
        val payloadSize = target * 3 / 4
        val json = "x".repeat(payloadSize)
        val encoded = Base64.getEncoder().encodeToString(json.toByteArray(Charsets.UTF_8))

        assertEquals(target, encoded.length)

        val scripts = buildChunkScripts(json, "buf5", chunkSize = chunkSize)
        assertEquals(2, scripts.chunks.size)
        assertReassemblesTo(json, scripts.chunks, "buf5")
    }

    /**
     * Simulates the JS-side reassembly: extract push payloads, join, base64-decode,
     * and verify the result matches the original JSON.
     */
    private fun assertReassemblesTo(expectedJson: String, chunkScripts: List<String>, bufferId: String) {
        val pushPrefix = """window.__cc["$bufferId"].push(""""
        val pushSuffix = """");"""

        val reassembled = chunkScripts.joinToString("") { script ->
            assertTrue("Chunk should use array push", script.startsWith(pushPrefix))
            assertTrue(script.endsWith(pushSuffix))
            script.removePrefix(pushPrefix).removeSuffix(pushSuffix)
        }

        val decoded = String(Base64.getDecoder().decode(reassembled), Charsets.UTF_8)
        assertEquals(expectedJson, decoded)
    }
}
