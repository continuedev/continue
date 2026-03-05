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

    fun `test file path with square brackets`() {
        val uri = "file:///path/to/[folder]/file.txt"
        val file = UriUtils.uriToFile(uri)
        assertEquals(File("/path/to/[folder]/file.txt"), file)
    }

    fun `test windows file URI with square brackets in path`() {
        val uri = "file://C:/Users/test/project/[gamemode]/resource/file.lua"
        val parsed = UriUtils.parseUri(uri)
        assertEquals("file:///C:/Users/test/project/%5Bgamemode%5D/resource/file.lua", parsed.toString())
    }

    fun `test windows file URI with spaces in path`() {
        val uri = "file://C:/Users/test/project name/resource/file.lua"
        val parsed = UriUtils.parseUri(uri)
        assertEquals("file:///C:/Users/test/project%20name/resource/file.lua", parsed.toString())
    }
}
