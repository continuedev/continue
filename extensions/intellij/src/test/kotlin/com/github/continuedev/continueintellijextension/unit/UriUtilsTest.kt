package com.github.continuedev.continueintellijextension.unit

import com.github.continuedev.continueintellijextension.`continue`.UriUtils
import org.junit.jupiter.api.Disabled
import org.junit.jupiter.api.Test
import java.io.File
import kotlin.test.assertEquals

class UriUtilsTest {
    @Test
    fun testUriToFile() {
        val uri = "file:///path/to/file"
        val file = UriUtils.uriToFile(uri)
        assertEquals(File("/path/to/file"), file)
    }

    @Disabled("Not working")
    @Test
    fun testUriToFileWithWindowsPath() {
        val uri = "file:///C:/path/to/file"
        val file = UriUtils.uriToFile(uri)
        assertEquals(File("C:/path/to/file"), file)
    }

    @Test
    fun shouldHandleAuthorityComponent() {
        val uri = "file://C:/path/to/file"
        val file = UriUtils.uriToFile(uri)
        assertEquals(File("/C:/path/to/file"), file)
    }

    @Test
    fun testUriToFileWithSpaces() {
        val uri = "file:///path/to/file%20with%20spaces"
        val file = UriUtils.uriToFile(uri)
        assertEquals(File("/path/to/file with spaces"), file)
    }

    @Test
    fun testUriToFileWithSpecialCharacters() {
        val uri = "file:///path/to/file%23with%25special%26chars"
        val file = UriUtils.uriToFile(uri)
        assertEquals(File("/path/to/file#with%special&chars"), file)
    }

    @Test
    fun testUriToFileWithQueryParams() {
        val uri = "file:///path/to/file?param=value"
        val file = UriUtils.uriToFile(uri)
        assertEquals(File("/path/to/file"), file)
    }

    @Test
    fun testUriToFileWithWSLPath() {
        val uri = "file:///wsl$/Ubuntu/home/user/file.txt"
        val file = UriUtils.uriToFile(uri)
        assertEquals(File("/wsl$/Ubuntu/home/user/file.txt"), file)
    }

    @Test
    fun testUriToFileWithWSLLocalhostPath() {
        val uri = "file:///wsl.localhost/Ubuntu/home/user/file.txt"
        val file = UriUtils.uriToFile(uri)
        assertEquals(File("/wsl.localhost/Ubuntu/home/user/file.txt"), file)
    }
}
