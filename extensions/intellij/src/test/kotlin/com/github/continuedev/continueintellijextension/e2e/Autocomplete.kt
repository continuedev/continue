package com.github.continuedev.continueintellijextension.e2e

import com.automation.remarks.junit5.Video
import com.github.continuedev.continueintellijextension.fixtures.dialog
import com.github.continuedev.continueintellijextension.fixtures.idea
import com.github.continuedev.continueintellijextension.fixtures.welcomeFrame
import com.github.continuedev.continueintellijextension.utils.RemoteRobotExtension
import com.github.continuedev.continueintellijextension.utils.StepsLogger
import com.intellij.remoterobot.RemoteRobot
import com.intellij.remoterobot.fixtures.ComponentFixture
import com.intellij.remoterobot.search.locators.byXpath
import com.intellij.remoterobot.steps.CommonSteps
import com.intellij.remoterobot.utils.keyboard
import com.intellij.remoterobot.utils.waitFor
import com.intellij.remoterobot.utils.waitForIgnoringError
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import java.time.Duration.ofMinutes
import java.time.Duration.ofSeconds

@ExtendWith(RemoteRobotExtension::class)
class Autocomplete {
    init {
        StepsLogger.init()
    }

    @BeforeEach
    fun waitForIde(remoteRobot: RemoteRobot) {
        System.setProperty("continue.autocomplete.test.environment", "true")
        waitForIgnoringError(ofMinutes(3)) { remoteRobot.callJs("true") }
    }

    @AfterEach
    fun closeProject(remoteRobot: RemoteRobot) {
        System.clearProperty("continue.autocomplete.test.environment")
        CommonSteps(remoteRobot).closeProject()
    }

    @Test
    @Video
    fun displayCompletion(remoteRobot: RemoteRobot): Unit = with(remoteRobot) {
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
                editor.clickOnOffset(userMsg.length)

                keyboard {
                    enterText(" ")
                }

                waitFor(ofSeconds(20)) {
                    editor.hasText("TEST_LLM_RESPONSE_0")
                }
            }
        }
    }
}