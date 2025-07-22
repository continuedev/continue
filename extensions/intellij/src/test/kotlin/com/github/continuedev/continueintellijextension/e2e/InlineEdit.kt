package com.github.continuedev.continueintellijextension.e2e

import com.automation.remarks.junit5.Video
import com.github.continuedev.continueintellijextension.fixtures.dialog
import com.github.continuedev.continueintellijextension.fixtures.idea
import com.github.continuedev.continueintellijextension.fixtures.welcomeFrame
import com.github.continuedev.continueintellijextension.utils.RemoteRobotExtension
import com.github.continuedev.continueintellijextension.utils.StepsLogger
import com.github.continuedev.continueintellijextension.utils.*
import com.intellij.remoterobot.RemoteRobot
import com.intellij.remoterobot.fixtures.ComponentFixture
import com.intellij.remoterobot.search.locators.byXpath
import com.intellij.remoterobot.steps.CommonSteps
import com.intellij.remoterobot.utils.keyboard
import com.intellij.remoterobot.utils.waitFor
import com.intellij.remoterobot.utils.waitForIgnoringError
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Disabled
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import java.awt.event.KeyEvent.VK_I
import java.time.Duration.ofMinutes
import java.time.Duration.ofSeconds

@ExtendWith(RemoteRobotExtension::class)
class InlineEdit {
    init {
        StepsLogger.init()
    }

    @BeforeEach
    fun waitForIde(remoteRobot: RemoteRobot) {
        waitForIgnoringError(ofMinutes(3)) { remoteRobot.callJs("true") }
    }

    @AfterEach
    fun closeProject(remoteRobot: RemoteRobot) = CommonSteps(remoteRobot).closeProject()

    @Test
    @Disabled("Failing in CI, seems like the timeout just needs to be increased")
    @Video
    fun submitInlineEdit(remoteRobot: RemoteRobot): Unit = with(remoteRobot) {
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
        waitFor(ofSeconds(20)) {
            findAll<ComponentFixture>(
                byXpath("//div[@accessiblename='Main.java' and @class='SingleHeightLabel']")
            ).isNotEmpty()
        }

        idea {
            with(textEditor()) {
                val userMsg = "TEST_USER_MESSAGE_0"
                editor.insertTextAtLine(0, 0, userMsg)
                editor.selectText(userMsg)

                keyboard {
                    hotKey(getMetaKey(), VK_I)
                }

                val textArea = find<ComponentFixture>(byXpath("//div[@class='CustomTextArea']"))
                textArea.hasText("Enter instructions...")

                val modelSelect = find<ComponentFixture>(byXpath("//div[@class='JComboBox']"))
                modelSelect.hasText("TEST LLM")

                keyboard {
                    enterText("Hello world!")
                }

                val enterBtn = find<ComponentFixture>(byXpath("//div[@class='CustomButton']"))
                enterBtn.click()

                val rejectText = "${getAltKeyLabel()}${getShiftKeyLabel()}N"
                val acceptText = "${getAltKeyLabel()}${getShiftKeyLabel()}Y"
                val acceptAllText = "Accept All (${getMetaKeyLabel()}${getShiftKeyLabel()}⏎)"
                val rejectAllText = "Reject All (${getMetaKeyLabel()}${getShiftKeyLabel()}⌫)"

                find<ComponentFixture>(byXpath("//div[@text='$rejectText']")).isShowing
                find<ComponentFixture>(byXpath("//div[@text='$acceptText']")).isShowing
                find<ComponentFixture>(byXpath("//div[@text='$acceptAllText']")).isShowing
                find<ComponentFixture>(byXpath("//div[@text='$rejectAllText']")).isShowing
            }
        }
    }
}