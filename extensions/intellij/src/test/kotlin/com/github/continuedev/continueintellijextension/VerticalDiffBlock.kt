package com.github.continuedev.continueintellijextension

import com.github.continuedev.continueintellijextension.editor.VerticalDiffBlock
import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.EditorFactory
import com.intellij.openapi.editor.colors.EditorColorsManager
import com.intellij.openapi.editor.colors.TextAttributesKey
import com.intellij.testFramework.LightVirtualFile
import com.intellij.openapi.fileTypes.PlainTextFileType
import com.intellij.testFramework.fixtures.BasePlatformTestCase

class VerticalDiffBlockTest : BasePlatformTestCase() {

    private lateinit var editor: Editor

    override fun setUp() {
        super.setUp()
        // Create a document and an editor with a virtual file
        val document = EditorFactory.getInstance().createDocument("")
        val virtualFile = LightVirtualFile("TestFile.kt", PlainTextFileType.INSTANCE, "")
        editor = EditorFactory.getInstance().createEditor(document, project, virtualFile, false)
    }

    override fun tearDown() {
        try {
            // Release the editor to avoid memory leaks
            EditorFactory.getInstance().releaseEditor(editor)
        } finally {
            super.tearDown()
        }
    }

    fun testAddNewLine() {
        // Arrange
        val textToAdd = "This is a new line"
        val startLine = 0

        // Create an instance of VerticalDiffBlock
        val verticalDiffBlock = VerticalDiffBlock(
            editor = editor,
            project = project,
            startLine = startLine,
            onAcceptReject = { _, _ -> }
        )

        // Act
        WriteCommandAction.runWriteCommandAction(project) {
            verticalDiffBlock.addNewLine(textToAdd, startLine)
        }

        // Assert
        val documentText = editor.document.text

        // We expect a newline to be inserted in addition to our line
        val expectedText = "$textToAdd\n\n"
        assertEquals(expectedText, documentText)

        // Check if the new line is highlighted
        val highlighters = editor.markupModel.allHighlighters.filter { highlighter ->
            val line = editor.document.getLineNumber(highlighter.startOffset)
            line == startLine
        }

        assertTrue("Expected at least one highlighter on the new line", highlighters.isNotEmpty())

        // Check the attributes of the highlighter
        val expectedTextAttributesKey = TextAttributesKey.find("CONTINUE_DIFF_NEW_LINE")
        val expectedAttributes = EditorColorsManager.getInstance().globalScheme.getAttributes(expectedTextAttributesKey)
        val highlighterAttributes = highlighters.first().textAttributes

        assertEquals(expectedAttributes.foregroundColor, highlighterAttributes?.foregroundColor)
    }
}