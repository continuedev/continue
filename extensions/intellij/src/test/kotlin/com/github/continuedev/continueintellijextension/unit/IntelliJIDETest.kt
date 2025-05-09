package com.github.continuedev.continueintellijextension.unit

import com.github.continuedev.continueintellijextension.`continue`.IntelliJIDE
import org.junit.jupiter.api.Disabled
import org.junit.jupiter.api.Test
import java.io.File
import kotlin.test.assertEquals

class IntelliJIDETest {
    @Test
    fun testUriToFile() {
        val uri = "file:///path/to/file"
        val file = IntelliJIDE.uriToFile(uri)
        assertEquals(File("/path/to/file"), file)
    }

    @Disabled("Not working")
    @Test
    fun testUriToFileWithWindowsPath() {
        val uri = "file:///C:/path/to/file"
        val file = IntelliJIDE.uriToFile(uri)
        assertEquals(File("C:/path/to/file"), file)
    }

    @Test
    fun testUriToFileWithSpaces() {
        val uri = "file:///path/to/file%20with%20spaces"
        val file = IntelliJIDE.uriToFile(uri)
        assertEquals(File("/path/to/file with spaces"), file)
    }

    @Test
    fun testUriToFileWithSpecialCharacters() {
        val uri = "file:///path/to/file%23with%25special%26chars"
        val file = IntelliJIDE.uriToFile(uri)
        assertEquals(File("/path/to/file#with%special&chars"), file)
    }

    @Test
    fun testUriToFileWithQueryParams() {
        val uri = "file:///path/to/file?param=value"
        val file = IntelliJIDE.uriToFile(uri)
        assertEquals(File("/path/to/file"), file)
    }
}