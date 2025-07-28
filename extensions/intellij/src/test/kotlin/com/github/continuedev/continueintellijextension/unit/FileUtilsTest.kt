package com.github.continuedev.continueintellijextension.unit

import com.github.continuedev.continueintellijextension.FileType
import com.github.continuedev.continueintellijextension.`continue`.file.FileUtils
import com.intellij.testFramework.UsefulTestCase
import com.intellij.testFramework.fixtures.CodeInsightTestFixture
import com.intellij.testFramework.fixtures.IdeaTestFixtureFactory

class FileUtilsTest : UsefulTestCase() {
    val fileUtils = FileUtils()
    val myFixture = setupRealFilesFixture()
    val tmpFixture get() = myFixture.tempDirFixture
    val tmpDir get() = myFixture.tempDirPath

    override fun setUp() =
        myFixture.setUp()

    override fun tearDown() =
        myFixture.tearDown()

    fun `test fileExists`() {
        val file = tmpFixture.createFile("test.txt", "")
        val uri = "file://${file.path}"
        assertTrue(fileUtils.fileExists(uri))
    }

    fun `test fileExists inside directory`() {
        val file = tmpFixture.createFile("dir/dir2/file.txt", "")
        val uri = "file://${file.path}"
        assertTrue(fileUtils.fileExists(uri))
    }

    fun `test fileExists fails when file doesn't exists`() {
        val uri = "file:///tmp/aaaa.txt"
        assertFalse(fileUtils.fileExists(uri))
    }

    fun `test readFile`() {
        val uri = "file://$tmpDir/bbbb.txt"
        tmpFixture.createFile("bbbb.txt", "contents")
        val text = fileUtils.readFile(uri)
        assertEquals("contents", text)
    }

    fun `test listDir`() {
        tmpFixture.createFile("a.txt", "a")
        tmpFixture.createFile("b.txt", "b")
        tmpFixture.createFile("c.txt", "c")
        tmpFixture.createFile("dir/invisibleA.txt", "d")
        tmpFixture.createFile("dir/invisibleB.txt", "e")

        val result = fileUtils.listDir("file://$tmpDir")

        assertTrue(result.any { it[0] == "a.txt" && it[1] == FileType.FILE.value })
        assertTrue(result.any { it[0] == "b.txt" && it[1] == FileType.FILE.value })
        assertTrue(result.any { it[0] == "c.txt" && it[1] == FileType.FILE.value })
        assertTrue(result.any { it[0] == "dir" && it[1] == FileType.DIRECTORY.value })
        assertTrue(result.any { it[0] == "dir" && it[1] == FileType.DIRECTORY.value })
        assertFalse(result.any { it[0] == "invisibleA.txt" })
        assertFalse(result.any { it[0] == "invisibleB.txt" })
        assertEquals(4, result.size)
    }

    private companion object {

        // note: with this, files will actually exist inside /tmp/unitTest/ dir, otherwise it's virtual
        fun setupRealFilesFixture(): CodeInsightTestFixture {
            val factory = IdeaTestFixtureFactory.getFixtureFactory()
            return factory.createCodeInsightFixture(
                factory.createLightFixtureBuilder("my_continue_project").fixture,
                factory.createTempDirTestFixture()
            )
        }

    }

}