/**
 * Currently we can't test any actions in the GUI that involve clicks.
 * See this open issue for details: https://github.com/JetBrains/intellij-ui-test-robot/issues/491
 */
package com.github.continuedev.continueintellijextension.e2e

import com.automation.remarks.junit5.Video
import com.github.continuedev.continueintellijextension.fixtures.*
import com.github.continuedev.continueintellijextension.utils.RemoteRobotExtension
import com.github.continuedev.continueintellijextension.utils.StepsLogger
import com.github.continuedev.continueintellijextension.utils.getMetaKey
import com.intellij.remoterobot.RemoteRobot
import com.intellij.remoterobot.fixtures.ComponentFixture
import com.intellij.remoterobot.search.locators.byXpath
import com.intellij.remoterobot.steps.CommonSteps
import com.intellij.remoterobot.stepsProcessing.step
import com.intellij.remoterobot.utils.keyboard
import com.intellij.remoterobot.utils.waitFor
import com.intellij.remoterobot.utils.waitForIgnoringError
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import java.awt.event.KeyEvent.*
import java.time.Duration.ofMinutes
import java.time.Duration.ofSeconds

@ExtendWith(RemoteRobotExtension::class)
class GUI {
    init {
        StepsLogger.init()
    }

    @BeforeEach
    fun waitForIde(remoteRobot: RemoteRobot) {
        waitForIgnoringError(ofMinutes(3)) { remoteRobot.callJs("true") }
    }

    @AfterEach
    fun closeProject(remoteRobot: RemoteRobot) = CommonSteps(remoteRobot).closeProject()

    //    @Test
    @Video
    fun highlightCode(remoteRobot: RemoteRobot): Unit = with(remoteRobot) {
        welcomeFrame {
            createNewProjectLink.click()
            dialog("New Project") {
                findText("Java").click()
                checkBox("Add sample code").select()
                button("Create").click()
            }
        }

        // Wait for the default "Main.java" tab to load
        // Our "continue_tutorial.java.ft" tab loads first, but then "Main.java" takes focus.
        // If we don't wait for this, clicking on the GUI may fail because a popup displays
        // while the `continue_tutorial.java` is loading.
        waitFor(ofSeconds(20)) {
            findAll<ComponentFixture>(
                byXpath("//div[@accessiblename='Main.java' and @class='SingleHeightLabel']")
            ).isNotEmpty()
        }

        idea {
            step("Manually open the webview") {
                // Manually open the webview
                find<ComponentFixture>(byXpath("//div[@text='Continue']"), ofSeconds((10))).click()

                waitFor(ofSeconds(10)) {
                    browser().isShowing
                }

                // Arbitrary timeout due to a bug where the webview will refresh
                // and clear the editor state on first load
                Thread.sleep(5000)
            }

            step("Verify we can highlight code and add to webview") {
                val textToInsert = "Hello world!"

                with(textEditor()) {
                    editor.insertTextAtLine(0, 0, textToInsert)
                    editor.selectText(textToInsert)

                    keyboard {
                        hotKey(getMetaKey(), VK_J)
                    }
                }

                waitFor(ofSeconds(10)) {
                    browser().findElementByContainsText(textToInsert).html.isNotEmpty()
                }
            }
        }
    }
}
