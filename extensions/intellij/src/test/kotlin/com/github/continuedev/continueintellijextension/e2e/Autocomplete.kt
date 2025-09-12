package com.github.continuedev.continueintellijextension.e2e

import com.automation.remarks.junit5.Video
import com.intellij.driver.sdk.ui.components.codeEditor
import com.intellij.driver.sdk.ui.components.ideFrame
import com.intellij.driver.sdk.ui.components.welcomeScreen
import com.intellij.driver.sdk.wait
import com.intellij.ide.starter.driver.engine.runIdeWithDriver
import com.intellij.ide.starter.ide.IdeProductProvider
import com.intellij.ide.starter.models.TestCase
import com.intellij.ide.starter.plugins.PluginConfigurator
import com.intellij.ide.starter.project.NoProject
import com.intellij.ide.starter.runner.Starter
import org.junit.Test
import java.io.File
import kotlin.time.Duration.Companion.seconds

class Autocomplete {

    @Video
    @Test
    fun simpleTestWithoutProject() {
        val starter = Starter.newContext("testExample", TestCase(IdeProductProvider.IC, NoProject).withVersion("2024.2"))
        val pluginPath = System.getProperty("path.to.build.plugin")
        println("pluginPath=$pluginPath") // todo: remove this line later
        PluginConfigurator(starter).installPluginFromFolder(File(pluginPath))
        starter.runIdeWithDriver().useDriverAndCloseIde {
            welcomeScreen {
                createNewProjectButton.click()
                wait(5.seconds)
                x("//div[@text='Create']").click()
            }
            ideFrame {
                x("//div[@visible_text='Main.java']").click()
                wait(5.seconds)
                keyboard {
                    enterText("TEST_USER_MESSAGE_0")
                }
                wait(5.seconds)
                assert(codeEditor().text.contains("TEST_LLM_RESPONSE_0")) // todo: assertion fails even if inlay text is visible, why?
            }
        }
    }

}