package com.github.continuedev.continueintellijextension.utils

/**
 * Source: https://github.com/JetBrains/intellij-ui-test-robot/blob/139a05eb99e9a49f13605626b81ad9864be23c96/ui-test-example/src/test/kotlin/org/intellij/examples/simple/plugin/utils/RemoteRobotExtension.kt
 */
import com.intellij.remoterobot.RemoteRobot
import com.intellij.remoterobot.fixtures.ContainerFixture
import com.intellij.remoterobot.search.locators.byXpath
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.logging.HttpLoggingInterceptor
import org.junit.jupiter.api.extension.AfterTestExecutionCallback
import org.junit.jupiter.api.extension.ExtensionContext
import org.junit.jupiter.api.extension.ParameterContext
import org.junit.jupiter.api.extension.ParameterResolver
import java.awt.image.BufferedImage
import java.io.ByteArrayOutputStream
import java.io.File
import java.lang.IllegalStateException
import java.lang.reflect.Method
import javax.imageio.ImageIO

class RemoteRobotExtension : AfterTestExecutionCallback, ParameterResolver {
    private val url: String = System.getProperty("remote-robot-url") ?: "http://127.0.0.1:8082"
    private val remoteRobot: RemoteRobot = if (System.getProperty("debug-retrofit")?.equals("enable") == true) {
        val interceptor: HttpLoggingInterceptor = HttpLoggingInterceptor().apply {
            this.level = HttpLoggingInterceptor.Level.BODY
        }
        val client = OkHttpClient.Builder().apply {
            this.addInterceptor(interceptor)
        }.build()
        RemoteRobot(url, client)
    } else {
        RemoteRobot(url)
    }
    private val client = OkHttpClient()

    override fun supportsParameter(parameterContext: ParameterContext?, extensionContext: ExtensionContext?): Boolean {
        return parameterContext?.parameter?.type?.equals(RemoteRobot::class.java) ?: false
    }

    override fun resolveParameter(parameterContext: ParameterContext?, extensionContext: ExtensionContext?): Any {
        return remoteRobot
    }

    override fun afterTestExecution(context: ExtensionContext?) {
        val testMethod: Method = context?.requiredTestMethod ?: throw IllegalStateException("test method is null")
        val testMethodName = testMethod.name
        val testFailed: Boolean = context.executionException?.isPresent ?: false
        if (testFailed) {
//            saveScreenshot(testMethodName)
            saveIdeaFrames(testMethodName)
            saveHierarchy(testMethodName)
        }
    }

    private fun saveScreenshot(testName: String) {
        fetchScreenShot().save(testName)
    }

    private fun saveHierarchy(testName: String) {
        val hierarchySnapshot =
            saveFile(url, "build/reports", "hierarchy-$testName.html")
        if (File("build/reports/styles.css").exists().not()) {
            saveFile("$url/styles.css", "build/reports", "styles.css")
        }
        println("Hierarchy snapshot: ${hierarchySnapshot.absolutePath}")
    }

    private fun saveFile(url: String, folder: String, name: String): File {
        val response = client.newCall(Request.Builder().url(url).build()).execute()
        return File(folder).apply {
            mkdirs()
        }.resolve(name).apply {
            writeText(response.body?.string() ?: "")
        }
    }

    private fun BufferedImage.save(name: String) {
        val bytes = ByteArrayOutputStream().use { b ->
            ImageIO.write(this, "png", b)
            b.toByteArray()
        }
        File("build/reports").apply { mkdirs() }.resolve("$name.png").writeBytes(bytes)
    }

    private fun saveIdeaFrames(testName: String) {
        remoteRobot.findAll<ContainerFixture>(byXpath("//div[@class='IdeFrameImpl']")).forEachIndexed { n, frame ->
            val pic = try {
                frame.callJs<ByteArray>(
                    """
                        importPackage(java.io)
                        importPackage(javax.imageio)
                        importPackage(java.awt.image)
                        const screenShot = new BufferedImage(component.getWidth(), component.getHeight(), BufferedImage.TYPE_INT_ARGB);
                        component.paint(screenShot.getGraphics())
                        let pictureBytes;
                        const baos = new ByteArrayOutputStream();
                        try {
                            ImageIO.write(screenShot, "png", baos);
                            pictureBytes = baos.toByteArray();
                        } finally {
                          baos.close();
                        }
                        pictureBytes;   
            """, true
                )
            } catch (e: Throwable) {
                e.printStackTrace()
                throw e
            }
            pic.inputStream().use {
                ImageIO.read(it)
            }.save(testName + "_" + n)
        }
    }

    private fun fetchScreenShot(): BufferedImage {
        return remoteRobot.callJs<ByteArray>(
            """
            importPackage(java.io)
            importPackage(javax.imageio)
            const screenShot = new java.awt.Robot().createScreenCapture(new Rectangle(Toolkit.getDefaultToolkit().getScreenSize()));
            let pictureBytes;
            const baos = new ByteArrayOutputStream();
            try {
                ImageIO.write(screenShot, "png", baos);
                pictureBytes = baos.toByteArray();
            } finally {
              baos.close();
            }
            pictureBytes;
        """
        ).inputStream().use {
            ImageIO.read(it)
        }
    }
}
