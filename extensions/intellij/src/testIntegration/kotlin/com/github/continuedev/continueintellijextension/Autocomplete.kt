package com.github.continuedev.continueintellijextension

import com.automation.remarks.junit5.Video
import com.intellij.driver.sdk.ui.components.*
import com.intellij.driver.sdk.waitFor
import com.intellij.driver.sdk.waitForProjectOpen
import com.intellij.ide.starter.driver.engine.runIdeWithDriver
import com.intellij.ide.starter.ide.IdeProductProvider
import com.intellij.ide.starter.models.TestCase
import com.intellij.ide.starter.plugins.PluginConfigurator
import com.intellij.ide.starter.project.NoProject
import com.intellij.ide.starter.runner.Starter
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.assertTrue
import java.io.File
import kotlin.time.Duration.Companion.seconds
import kotlin.time.Duration.Companion.minutes

class Autocomplete {

    @Video
    @Test
    fun testAutocomplete() {
        val starter = Starter.newContext("testExample", TestCase(IdeProductProvider.IC, NoProject).withVersion("2024.3"))
        PluginConfigurator(starter).installPluginFromFolder(File(System.getProperty("CONTINUE_PLUGIN_DIR")))
        starter.runIdeWithDriver().useDriverAndCloseIde {
            welcomeScreen {
                createNewProjectButton.click()
                button("Create").click()
            }
            waitForProjectOpen(1.minutes)
            ideFrame {
                editorTabs {
                    clickTab("Main.java")
                }
                codeEditor {
                    click()
                    keyboard {
                        enterText("TEST_USER_MESSAGE_0")
                        space()
                    }
                    waitFor(
                        message = "Test autocomplete suggestion",
                        timeout = 30.seconds,
                        errorMessage = { "Editor text: $text; inlay hints: ${getInlayHints().map { it.text }}" }
                    ) {
                        // Driver 243 reports the inline renderer identity instead of suggestion text.
                        getInlayHints().any {
                            it.text.contains("TEST_LLM_RESPONSE_0") ||
                                it.text.contains("InlineCompletionLineRenderer")
                        }
                    }
                    keyboard {
                        tab()
                    }
                    waitFor(
                        message = "Accepted test autocomplete",
                        timeout = 10.seconds,
                        errorMessage = { "Editor text: $text" }
                    ) {
                        text.contains("TEST_LLM_RESPONSE_0")
                    }
                    assertTrue(text.contains("TEST_LLM_RESPONSE_0"), "Editor text: $text")
                }
            }
        }
    }

}
