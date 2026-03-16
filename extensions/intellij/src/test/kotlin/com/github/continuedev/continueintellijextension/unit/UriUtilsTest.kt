package com.github.continuedev.continueintellijextension.unit

import com.github.continuedev.continueintellijextension.`continue`.UriUtils
import junit.framework.TestCase
import java.io.File

class UriUtilsTest : TestCase() {
    fun `test URI to File`() {
        val uri = "file:///path/to/file"
        val file = UriUtils.uriToFile(uri)
        assertEquals(File("/path/to/file"), file)
    }

    // fixme it's not working
    // fun `test Windows path`() {
    //     val uri = "file:///C:/path/to/file"
    //     val file = UriUtils.uriToFile(uri)
    //     assertEquals(File("C:/path/to/file"), file)
    // }

    fun `test spaces`() {
        val uri = "file:///path/to/file%20with%20spaces"
        val file = UriUtils.uriToFile(uri)
        assertEquals(File("/path/to/file with spaces"), file)
    }

    fun `test special characters`() {
        val uri = "file:///path/to/file%23with%25special%26chars"
        val file = UriUtils.uriToFile(uri)
        assertEquals(File("/path/to/file#with%special&chars"), file)
    }

    fun `test query params`() {
        val uri = "file:///path/to/file?param=value"
        val file = UriUtils.uriToFile(uri)
        assertEquals(File("/path/to/file"), file)
    }

    fun `test WSL path`() {
        val uri = "file:///wsl$/Ubuntu/home/user/file.txt"
        val file = UriUtils.uriToFile(uri)
        assertEquals(File("/wsl$/Ubuntu/home/user/file.txt"), file)
    }

    fun `test WSL localhost path`() {
        val uri = "file:///wsl.localhost/Ubuntu/home/user/file.txt"
        val file = UriUtils.uriToFile(uri)
        assertEquals(File("/wsl.localhost/Ubuntu/home/user/file.txt"), file)
    }

    /**
     * Validates that unencoded space characters in file URIs are handled
     * correctly by the URI parser, ensuring proper conversion to File objects.
     * This is a regression test for GitHub issue #10613.
     */
    fun `test unencoded spaces`() {
        // Verify that a URI string containing literal spaces can be parsed
        val uri = "file:///path/to/file with spaces"
        val result = UriUtils.uriToFile(uri)
        val expectedFile = File("/path/to/file with spaces")
        assertEquals(expectedFile, result)
    }

    /**
     * Validates that square brackets in file paths are handled correctly.
     * This is a regression test for GitHub issue #10978.
     * Frameworks like Next.js and FiveM use bracket-named directories
     * (e.g. [gamemode]) which caused URI parsing to crash.
     */
    fun `test square brackets in path`() {
        val uri = "file:///path/to/[gamemode]/file.lua"
        val result = UriUtils.uriToFile(uri)
        assertEquals(File("/path/to/[gamemode]/file.lua"), result)
    }

    /**
     * Validates that Windows-style file URIs with square brackets are handled.
     * Regression test for GitHub issue #10978 — the original crash occurred
     * specifically with Windows two-slash file:// URIs.
     */
    fun `test Windows path with square brackets`() {
        val uri = "file://C:/Users/user/projects/[gamemode]/file.lua"
        val parsed = UriUtils.parseUri(uri)
        assertEquals("file", parsed.scheme)
        assertTrue("Brackets should be percent-encoded in URI path",
            parsed.path.contains("%5B") && parsed.path.contains("%5D"))
        assertTrue("Path should contain drive letter",
            parsed.path.contains("C:") || parsed.path.contains("c:"))
        assertTrue("Path should preserve full directory structure",
            parsed.path.contains("Users/user/projects"))
    }
}
