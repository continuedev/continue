package com.github.continuedev.continueintellijextension.unit

import com.github.continuedev.continueintellijextension.autocomplete.ContinueInlineCompletionProvider
import com.github.continuedev.continueintellijextension.autocomplete.CompletionService
import com.github.continuedev.continueintellijextension.services.ContinueExtensionSettings
import com.intellij.codeInsight.inline.completion.InlineCompletionHandler
import com.intellij.codeInsight.inline.completion.testInlineCompletion
import com.intellij.openapi.fileTypes.PlainTextFileType
import com.intellij.testFramework.fixtures.BasePlatformTestCase
import com.intellij.testFramework.replaceService
import org.junit.jupiter.api.Assertions.assertDoesNotThrow
import java.util.UUID

@Suppress("UnstableApiUsage")
class ContinueInlineCompletionProviderTest : BasePlatformTestCase() {

    override fun runInDispatchThread() =
        false

    override fun setUp() {
        super.setUp()
        InlineCompletionHandler.registerTestHandler(ContinueInlineCompletionProvider(), testRootDisposable)
    }

    fun `test don't show when settings are disabled`() = myFixture.testInlineCompletion {
        registerSuggestion("b")
        init(PlainTextFileType.INSTANCE, "a<caret>")
        ContinueExtensionSettings.instance.continueState.enableTabAutocomplete = false
        callInlineCompletion()
        delay()
        assertNoLookup()
    }


    fun `test show completion on Ctrl + Space, then insert with Tab`() = myFixture.testInlineCompletion {
        registerSuggestion("subtract(a: Int, b: Int) = a - b")
        init(
            PlainTextFileType.INSTANCE,
            """
            class Calculator {
               fun add(a: Int, b: Int) = a + b
               fun <caret>
            }
            """.trimIndent()
        )
        callInlineCompletion()
        delay()
        insertWithTab()
        assertFileContent(
            """
            class Calculator {
               fun add(a: Int, b: Int) = a + b
               fun subtract(a: Int, b: Int) = a - b<caret>
            }
            """.trimIndent()
        )
    }

    fun `test inline completion that updates as the user types`() = myFixture.testInlineCompletion {
        registerSuggestion("4567890'")
        init(PlainTextFileType.INSTANCE, "digits = '123<caret>")
        callInlineCompletion()
        delay()
        typeChar('4')
        typeChar('5')
        assertInlineRender("67890'")
        typeChar('6')
        insertWithTab()
        assertFileContent("digits = '1234567890'<caret>")
    }

    fun `test multiline`() = myFixture.testInlineCompletion {
        registerSuggestion(": i32) -> i32 {\n    a + b\n}")
        init(PlainTextFileType.INSTANCE, "fn add(a: i32, b<caret>")
        callInlineCompletion()
        delay()
        insertWithTab()
        assertFileContent(
            """
            fn add(a: i32, b: i32) -> i32 {
                a + b
            }<caret>
            """.trimIndent()
        )
    }

    fun `test accepting completion notifies the service with valid UUID`() = myFixture.testInlineCompletion {
        var uuid: String? = null
        registerSuggestion("test") { uuid = it }
        init(PlainTextFileType.INSTANCE, "test <caret>")
        callInlineCompletion()
        delay()
        insertWithTab()
        assertFileContent("test test<caret>")
        assertDoesNotThrow {
            UUID.fromString(uuid)
        }
    }

    fun `test not accepting completions is not notifying service with UUID`() = myFixture.testInlineCompletion {
        var uuid: String? = null
        registerSuggestion("test") { uuid = it }
        init(PlainTextFileType.INSTANCE, "test <caret>")
        callInlineCompletion()
        delay()
        assertInlineRender("test")
        assertNull(uuid)
    }

    private fun registerSuggestion(variant: String?, accept: (String?) -> Unit = {}) =
        myFixture.project.replaceService(
            CompletionService::class.java,
            object : CompletionService {
                override suspend fun getAutocomplete(uuid: String, url: String, line: Int, column: Int): String? =
                    variant

                override fun acceptAutocomplete(uuid: String?) =
                    accept(uuid)
            },
            testRootDisposable
        )
}