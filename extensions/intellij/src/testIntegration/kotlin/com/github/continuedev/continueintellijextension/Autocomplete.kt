package com.github.continuedev.continueintellijextension

import com.automation.remarks.junit5.Video
import com.intellij.driver.sdk.ui.components.*
import com.intellij.driver.sdk.wait
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
            ideFrame {
                editorTabs {
                    clickTab("Main.java")
                }
                codeEditor {
                    // Allow initial indexing and background workers to settle on CI
                    wait(5.seconds)
                    keyboard {
                        enterText("TEST_USER_MESSAGE_0")
                        space()
                    }
                    // Wait for the LLM inline completion to be rendered and accepted via Tab
                    var matched = false
                    for (i in 1..10) {
                        wait(2.seconds)
                        keyboard {
                            tab()
                        }
                        if (text.contains("TEST_LLM_RESPONSE_0")) {
                            matched = true
                            break
                        }
                    }
                    assertTrue(matched, "Expected editor text to contain TEST_LLM_RESPONSE_0 after autocomplete tab, but was: $text")
                }
            }
        }
    }

}
