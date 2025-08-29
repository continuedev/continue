package com.github.continuedev.continueintellijextension.`continue`.process

import com.github.continuedev.continueintellijextension.error.ContinuePostHogService
import com.github.continuedev.continueintellijextension.error.ContinueSentryService
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.Logger
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter

class ContinueProcessHandler(
    private val parentScope: CoroutineScope,
    private val readMessage: (String) -> (Unit),
    private val createProcess: () -> ContinueProcess
) {
    private val pendingWrites = Channel<String>(Channel.UNLIMITED)
    private val backoff = BackoffCalculator()
    private var processScope: CoroutineScope? = null
    private var process: ContinueProcess? = null

    init {
        restart()
    }

    fun restart() {
        LOG.warn("Starting Continue process")
        processScope?.cancel()
        process?.close()

        val handler = CoroutineExceptionHandler { _, e ->
            service<ContinueSentryService>().report(e)
            service<ContinuePostHogService>().capture("jetbrains_core_exit", mapOf("error" to e))

            val backoffDuration = backoff.nextDuration()
            LOG.warn("Process failed! Restarting in $backoffDuration")
            parentScope.launch {
                delay(backoffDuration)
                restart()
            }
        }

        val job = SupervisorJob(parentScope.coroutineContext.job)
        processScope = CoroutineScope(parentScope.coroutineContext + job + handler)
        process = createProcess()

        val reader = BufferedReader(InputStreamReader(process!!.input))
        val writer = OutputStreamWriter(process!!.output)

        processScope!!.launch(Dispatchers.IO) {
            while (isActive) {
                val line = reader.readLine()
                if (line != null && line.isNotEmpty())
                    readMessage(line)
            }
        }
        processScope!!.launch(Dispatchers.IO) {
            for (message in pendingWrites) {
                writer.write(message)
                writer.write("\r\n")
                writer.flush()
            }
        }
    }

    fun write(message: String) =
        pendingWrites.trySend(message)

    private companion object {
        private val LOG = Logger.getInstance(ContinueProcessHandler::class.java.simpleName)
    }
}
