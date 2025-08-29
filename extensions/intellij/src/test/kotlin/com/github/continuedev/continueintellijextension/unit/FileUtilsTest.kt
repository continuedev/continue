package com.github.continuedev.continueintellijextension.unit

import com.github.continuedev.continueintellijextension.FileType
import com.github.continuedev.continueintellijextension.`continue`.file.FileUtils
import com.intellij.openapi.application.runWriteAction
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.vfs.VfsUtil
import com.intellij.testFramework.UsefulTestCase
import com.intellij.testFramework.fixtures.CodeInsightTestFixture
import com.intellij.testFramework.fixtures.IdeaTestFixtureFactory

class FileUtilsTest : UsefulTestCase() {
    private val myFixture = setupRealFilesFixture()
    private lateinit var fileUtils: FileUtils
    private val tmp get() = myFixture.tempDirPath

    override fun setUp() {
        myFixture.setUp()
        fileUtils = FileUtils(myFixture.project)
    }

    override fun tearDown() =
        myFixture.tearDown()

    fun `test fileExists`() {
        myFixture.createTempFile("file.txt")
        assertTrue(fileUtils.fileExists("file://$tmp/file.txt"))
    }

    fun `test fileExists with dir`() {
        myFixture.createTempFile("dir/dir/file.txt")
        assertTrue(fileUtils.fileExists("file://$tmp/dir/dir/file.txt"))
    }

    fun `test fileExists fails when file is missing`() {
        assertFalse(fileUtils.fileExists("file://missing.txt"))
    }

    fun `test fileExists fails when file and dir are missing`() {
        assertFalse(fileUtils.fileExists("file://dir/missing.txt"))
    }

    fun `test writeFile creates missing file`() {
        fileUtils.writeFile("file://$tmp/file.txt", "text")
        assertEquals("text", myFixture.readTempFile("file.txt"))
    }

    fun `test writeFile creates missing file and missing dirs`()  {
        fileUtils.writeFile("file://$tmp/missing/dir/to/file.txt", "text")
        assertEquals("text", myFixture.readTempFile("missing/dir/to/file.txt"))
    }

    fun `test writeFile overwrites existing file`() {
        myFixture.createTempFile("file.txt", "old_text")
        fileUtils.writeFile("file://$tmp/overwrite.txt", "new_text")
        assertEquals("new_text", myFixture.readTempFile("overwrite.txt"))
    }

    fun `test readFile`() {
        myFixture.createTempFile("file.txt", "text")
        assertEquals("text", fileUtils.readFile("file://$tmp/file.txt"))
    }

    fun `test readFile limits the output to specified length`() {
        myFixture.createTempFile("limited.txt", "text")
        val text = fileUtils.readFile("file://$tmp/limited.txt", maxLength = 3)
        assertEquals("tex", text)
    }

    fun `test readFile inside dir`() {
        myFixture.createTempFile("dir/dir/file.txt", "text")
        assertEquals("text", fileUtils.readFile("file://$tmp/dir/dir/file.txt"))
    }

    fun `test readFile fails when file is missing`() {
        assertEmpty(fileUtils.readFile("file://missing.txt"))
    }

    fun `test readFile normalizes line endings`() {
        myFixture.createTempFile("file.txt", "line\r\nline\rline\nline")
        val normalized = fileUtils.readFile("file://$tmp/file.txt")
        assertEquals("line\nline\nline\nline", normalized)
    }

    fun `test listDir`() {
        myFixture.createTempFile("a.txt", "a")
        myFixture.createTempFile("b.txt", "b")
        myFixture.createTempFile("c.txt", "c")
        myFixture.createTempFile("dir/invisibleA.txt", "d")
        myFixture.createTempFile("dir/invisibleB.txt", "e")

        val result = fileUtils.listDir("file://$tmp")

        assertTrue(result.any { it[0] == "a.txt" && it[1] == FileType.FILE.value })
        assertTrue(result.any { it[0] == "b.txt" && it[1] == FileType.FILE.value })
        assertTrue(result.any { it[0] == "c.txt" && it[1] == FileType.FILE.value })
        assertTrue(result.any { it[0] == "dir" && it[1] == FileType.DIRECTORY.value })
        assertTrue(result.any { it[0] == "dir" && it[1] == FileType.DIRECTORY.value })
        assertFalse(result.any { it[0] == "invisibleA.txt" })
        assertFalse(result.any { it[0] == "invisibleB.txt" })
        assertEquals(4, result.size)
    }

    fun `test listDir works with empty dir`() {
        val result = fileUtils.listDir("file://$tmp")
        assertEmpty(result)
    }

    fun `test listDir invalid usage with file instead of dir results in empty list`() {
        myFixture.createTempFile("file.txt")
        val invalid = fileUtils.listDir("file://$tmp/file.txt")
        assertEmpty(invalid)
    }

    fun `test openFile opens editor`() {
        myFixture.createTempFile("file.txt", "text")
        fileUtils.openFile("file://$tmp/file.txt")
        val virtualFile = myFixture.tempDirFixture.getFile("file.txt")!!
        assertTrue(FileEditorManager.getInstance(myFixture.project).isFileOpen(virtualFile))
    }

    fun `test openFile ignores non-existing file`() {
        fileUtils.openFile("file://$tmp/invalid.txt")
    }

    fun `test saveFile`() {
        val manager = FileDocumentManager.getInstance()
        val modified = myFixture.createTempFile("modified.txt")
        val document = manager.getDocument(modified)!!
        runWriteAction {
            document.setText("modified content")
        }
        assertTrue(manager.isDocumentUnsaved(document))
        fileUtils.saveFile("file://$tmp/modified.txt")
        assertFalse(manager.isDocumentUnsaved(document))
    }

    fun `test getFileStats`() {
        myFixture.createTempFile("a.txt", "aa")
        myFixture.createTempFile("b.txt", "bbbbb")

        val stats = fileUtils.getFileStats(listOf("file://$tmp/a.txt", "file://$tmp/b.txt"))

        assertTrue(stats.any { (fileUri, stats) -> fileUri == "file://$tmp/a.txt" && stats.size == 2L })
        assertTrue(stats.any { (fileUri, stats) -> fileUri == "file://$tmp/b.txt" && stats.size == 5L })
    }

    fun `test getFileStats ignores non-existing file`() {
        assertTrue(fileUtils.getFileStats(listOf("file://invalid.txt")).isEmpty())
    }

    private companion object {
        // note: with this, files will actually exist inside /tmp/unitTest/ dir, otherwise it's virtual
        private fun setupRealFilesFixture(): CodeInsightTestFixture {
            val factory = IdeaTestFixtureFactory.getFixtureFactory()
            return factory.createCodeInsightFixture(
                factory.createLightFixtureBuilder("my_continue_project").fixture,
                factory.createTempDirTestFixture()
            )
        }

        private fun CodeInsightTestFixture.createTempFile(path: String, content: String = "") =
            tempDirFixture.createFile(path, content)

        private fun CodeInsightTestFixture.readTempFile(path: String): String {
            val file = tempDirFixture.getFile(path)!!
            VfsUtil.markDirtyAndRefresh(false, false, false, file)
            return VfsUtil.loadText(file)
        }
    }
}