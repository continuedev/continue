package com.github.continuedev.continueintellijextension

import com.intellij.remoterobot.RemoteRobot
import com.intellij.remoterobot.fixtures.JCefBrowserFixture
import com.intellij.remoterobot.search.locators.byXpath
import org.junit.jupiter.api.Test
import java.util.concurrent.TimeUnit
//import org.junit.jupiter.api.extension.ExtendWith
import com.intellij.remoterobot.stepsProcessing.step

//import org.intellij.examples.simple.plugin.utils.RemoteRobotExtension

//@ExtendWith(RemoteRobotExtension::class)
class BrowserTest {
//    init {
//        StepsLogger.init()
//    }

    private val remoteRobot = RemoteRobot("http://127.0.0.1:8082")

    @Test
    fun testAccessJCefBrowser() {
        // Assume that JCefBrowser is within a frame, window, or dialog in your application.
        // Locate the JCefBrowser component. You might need to update the XPath based on your UI structure.
        val jCefBrowser = remoteRobot.find(
            JCefBrowserFixture::class.java,
            byXpath("//div[@class='JCefBrowserComponent']")
        )

        // Interact with the JCef Browser
        remoteRobot.run {
            step("Navigate to a URL in JCEF") {
                // Replace with code that interacts with the JCEF Browser.
                // This might involve accessing browser features or performing navigation.
                jCefBrowser.runJs("component.loadURL('https://continue')")
            }

            step("Check if URL loaded successfully") {
                TimeUnit.SECONDS.sleep(5) // Wait for the page to load
                // Example JS command to check a condition in the Browser
                val title = jCefBrowser.callJs<String>("return component.getTitle();")
                assert(title.contains("Example Domain")) { "Title does not match" }
            }
        }
    }
}