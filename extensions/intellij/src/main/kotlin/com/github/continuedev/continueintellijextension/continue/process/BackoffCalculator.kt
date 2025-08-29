package com.github.continuedev.continueintellijextension.`continue`.process

import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds

/**
 * Starts at [initialDuration] and doubles on each call to [nextDuration] up to [maxDuration].
 */
class BackoffCalculator(
    private val initialDuration: Duration = 1.seconds,
    private val maxDuration: Duration = 30.seconds
) {
    private var currentTime: Duration = initialDuration

    init {
        require(initialDuration > 0.seconds)
    }

    fun nextDuration(): Duration {
        val delay = currentTime
        val next = currentTime * 2.0
        currentTime = if (next <= maxDuration) next else maxDuration
        return delay
    }
}
