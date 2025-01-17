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
import com.intellij.remoterobot.stepsProcessing.step
import com.intellij.remoterobot.utils.waitFor
import com.intellij.remoterobot.utils.waitForIgnoringError
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import java.time.Duration.ofMinutes
import java.time.Duration.ofSeconds

@ExtendWith(RemoteRobotExtension::class)
class Onboarding {
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
    fun onboarding(remoteRobot: RemoteRobot): Unit = with(remoteRobot) {
        welcomeFrame {
            createNewProjectLink.click()
            dialog("New Project") {
                findText("Java").click()
                checkBox("Add sample code").select()
                button("Create").click()
            }
        }

        idea {
            // Wait for the default "Main.java" tab to load
            // Our "continue_tutorial.java.ft" tab loads first, but then "Main.java" takes focus.
            // So we need to wait for that to occur, and then focus on "continue_tutorial.java.ft"
            waitFor(ofSeconds(20)) {
                findAll<ComponentFixture>(
                    byXpath("//div[@accessiblename='Main.java' and @class='SingleHeightLabel']")
                ).isNotEmpty()
            }

            // TODO: Need a good way to ensure this is the first test ran in the entire suite
//            step("Verify Continue tutorial file is loaded") {
//                find<ComponentFixture>(byXpath("//div[@visible_text='continue_tutorial.java']"))
//            }

            step("Manually open the webview") {
                // Manually open the webview
                find<ComponentFixture>(byXpath("//div[@text='Continue']"), ofSeconds((10))).click()

                waitFor(ofSeconds(10)) {
                    browser().isShowing
                }
            }

            step("Verify the onboarding card is present") {
                waitFor(ofSeconds(30)) {
                    try {
                        browser().findElement("//*[@data-testid='onboarding-card']").html.isNotEmpty()
                    } catch (e: Exception) {
                        false
                    }
                }
            }
        }
    }
}
