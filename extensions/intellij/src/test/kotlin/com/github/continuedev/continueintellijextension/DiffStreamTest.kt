package com.github.continuedev.continueintellijextension

import com.github.continuedev.continueintellijextension.editor.DiffStreamHandler
import com.github.continuedev.continueintellijextension.editor.DiffStreamService
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.impl.ImaginaryEditor
import com.intellij.testFramework.TestDataPath
import com.intellij.testFramework.fixtures.BasePlatformTestCase

@TestDataPath("\$CONTENT_ROOT/src/test/testData")
class DiffStreamTest : BasePlatformTestCase() {
    fun `test getAllInlaysForEditor`() {
        myFixture.configureByText("index.ts", "console.log('Hello World!');")
        val editor = ImaginaryEditor(myFixture.project, myFixture.editor.document)

        val diffStreamService = project.service<DiffStreamService>()
        val diffStreamHandler = DiffStreamHandler(project, editor, 0, 1, { -> }, { -> })

        diffStreamService.register(diffStreamHandler, editor)

        diffStreamHandler.streamDiffLinesToEditor()

        assertEquals(editor.document.text, myFixture.file.text)
    }
}