package com.github.continuedev.continueintellijextension.e2e

import com.automation.remarks.junit5.Video
import com.github.continuedev.continueintellijextension.pages.dialog
import com.github.continuedev.continueintellijextension.pages.idea
import com.github.continuedev.continueintellijextension.pages.welcomeFrame
import com.github.continuedev.continueintellijextension.utils.RemoteRobotExtension
import com.github.continuedev.continueintellijextension.utils.StepsLogger
import com.github.continuedev.continueintellijextension.utils.getMetaKey
import com.intellij.remoterobot.RemoteRobot
import com.intellij.remoterobot.fixtures.ComponentFixture
import com.intellij.remoterobot.fixtures.JCefBrowserFixture
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
    @Video
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
                byXpath("//div[@accessiblename='Main.java' and @class='EditorTabLabel']")
            ).isNotEmpty()
        }

        val tutorialEditorTabLocator: Locator =
            byXpath("//div[@accessiblename='continue_tutorial.java' and @class='EditorTabLabel']")
        val tutorialEditorTab: ComponentFixture =
            remoteRobot.find(ComponentFixture::class.java, tutorialEditorTabLocator)
        tutorialEditorTab.click()

        // Manually open the webview
        find<ComponentFixture>(byXpath("//div[@text='Continue']")).click()

        // Arbitrary sleep while we wait for the webview to load
        Thread.sleep(10000)

        val textToInsert = "Hello world!"

        idea {
            with(textEditor()) {
                editor.insertTextAtLine(0, 0, textToInsert)
                editor.selectText(textToInsert)
                keyboard {
                    hotKey(getMetaKey(), VK_J)
                }
            }
        }

        // TODO: locator needs to be OS aware
        // https://github.com/JetBrains/intellij-ui-test-robot/blob/139a05eb99e9a49f13605626b81ad9864be23c96/remote-fixtures/src/main/kotlin/com/intellij/remoterobot/fixtures/CommonContainerFixture.kt#L203
        val jcefBrowser = find<JCefBrowserFixture>(JCefBrowserFixture.macLocator)
        assert(jcefBrowser.getDom().isNotEmpty()) { "JCEF browser not found or empty" }

        val codeSnippetText = jcefBrowser.findElementByContainsText(textToInsert)
        assert(codeSnippetText.html.isNotEmpty()) { "Failed to find code snippet in webview" }
    }
}