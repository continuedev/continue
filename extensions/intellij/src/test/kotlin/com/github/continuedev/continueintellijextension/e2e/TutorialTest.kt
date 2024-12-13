package com.github.continuedev.continueintellijextension.e2e

import com.github.continuedev.continueintellijextension.pages.dialog
import com.github.continuedev.continueintellijextension.pages.idea
import com.github.continuedev.continueintellijextension.pages.welcomeFrame
import com.github.continuedev.continueintellijextension.utils.RemoteRobotExtension
import com.github.continuedev.continueintellijextension.utils.StepsLogger
import com.intellij.remoterobot.RemoteRobot
import com.intellij.remoterobot.fixtures.ComponentFixture
import com.intellij.remoterobot.search.locators.Locator
import com.intellij.remoterobot.search.locators.byXpath
import com.intellij.remoterobot.steps.CommonSteps
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
class TutorialTest {
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
    fun completeTutorial(remoteRobot: RemoteRobot) = with(remoteRobot) {
        welcomeFrame {
            createNewProjectLink.click()
            dialog("New Project") {
                findText("Java").click()
                checkBox("Add sample code").select()
                button("Create").click()
            }
        }

        // Wait for the default "Main.java" tab to load
        // Our "continue_tutorial.java" tab loads first, but then "Main.java" takes focus.
        // So we need to wait for that to occur, and then focus on "continue_tutorial.java"
        waitFor(ofSeconds(20)) {
            findAll<ComponentFixture>(
                byXpath("//div[@accessiblename='Main.java' and @class='SingleHeightLabel']")
            ).isNotEmpty()
        }

        val tutorialEditorTabLocator: Locator =
            byXpath("//div[@accessiblename='continue_tutorial.java' and @class='SingleHeightLabel']")
        val tutorialEditorTab: ComponentFixture =
            remoteRobot.find(ComponentFixture::class.java, tutorialEditorTabLocator)
        tutorialEditorTab.click()

        idea {
            waitFor(ofMinutes(5)) { isDumbMode().not() }
            with(textEditor()) {
                editor.insertTextAtLine(0, 0, "Continue")
                editor.selectText("Continue")
                keyboard {
                    hotKey(VK_META, VK_J)
                }
            }
        }

        Thread.sleep(10000)
//
//        val textEditor = remoteRobot.find(
//            TextEditorFixture::class.java,
//            TextEditorFixture.locator
//        )
//
//        val editor = textEditor.editor
//        editor.text = "Continue"
//        editor.selectText("Continue")
//
//        remoteRobot.keyboard {
//            hotKey(Key.CMD, Key.J)
//        }


//        welcomeFrame {
//            createNewProjectLink.click()
//            assert(createNewProjectLink.hasText(""));

//            val loginToGitHub: JLabelFixture = remoteRobot.find(JLabelFixture::class.java)
//
//            assert(loginToGitHub.value.isNotEmpty()) { "Expected text not found on the screen." }

//            dialog("New Project") {
//                findText("Java").click()
//                checkBox("Add sample code").select()
//                button("Create").click()
//            }
//        }

//        idea {
//            waitFor(ofMinutes(5)) { isDumbMode().not() }
//
//            this@idea.find<CommonContainerFixture>(
//                byXpath("//div[@accessiblename='continue_tutorial.java' and @class='SimpleColoredComponent']"),
//                ofSeconds(5)
//            ).click()
//        }
    }
}