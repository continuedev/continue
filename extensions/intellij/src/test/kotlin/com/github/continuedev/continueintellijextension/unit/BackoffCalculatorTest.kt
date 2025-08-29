package com.github.continuedev.continueintellijextension.unit

import com.github.continuedev.continueintellijextension.`continue`.process.BackoffCalculator
import junit.framework.TestCase
import kotlin.time.Duration.Companion.seconds

class BackoffCalculatorTest : TestCase() {

    fun `test backoff`() {
        val backoff = BackoffCalculator(initialDuration = 1.seconds, maxDuration = 30.seconds)
        assertEquals(1.seconds, backoff.nextDuration())
        assertEquals(2.seconds, backoff.nextDuration())
        assertEquals(4.seconds, backoff.nextDuration())
        assertEquals(8.seconds, backoff.nextDuration())
        assertEquals(16.seconds, backoff.nextDuration())
        assertEquals(30.seconds, backoff.nextDuration())
        assertEquals(30.seconds, backoff.nextDuration())
    }

}