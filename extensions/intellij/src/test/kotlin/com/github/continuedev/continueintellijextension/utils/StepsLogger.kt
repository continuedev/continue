package com.github.continuedev.continueintellijextension.utils

/**
 * Source: https://github.com/JetBrains/intellij-ui-test-robot/blob/139a05eb99e9a49f13605626b81ad9864be23c96/ui-test-example/src/test/kotlin/org/intellij/examples/simple/plugin/utils/StepsLogger.kt
 */
import com.intellij.remoterobot.stepsProcessing.StepLogger
import com.intellij.remoterobot.stepsProcessing.StepWorker

object StepsLogger {
    private var initialized = false

    @JvmStatic
    fun init() {
        if (initialized.not()) {
            StepWorker.registerProcessor(StepLogger())
            initialized = true
        }
    }
}