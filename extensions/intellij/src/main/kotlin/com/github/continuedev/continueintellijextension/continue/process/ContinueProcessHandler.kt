package com.github.continuedev.continueintellijextension.`continue`.process

import com.github.continuedev.continueintellijextension.error.ContinueErrorService
import com.intellij.openapi.components.service
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter

class ContinueProcessHandler(
    coroutineScope: CoroutineScope,
    private val process: ContinueProcess,
    handleMessage: (String) -> (Unit)
) {
    private val pendingWrites = Channel<String>(Channel.Factory.UNLIMITED)
    private val writer = OutputStreamWriter(process.output)
    private val reader = BufferedReader(InputStreamReader(process.input))

    init {
        coroutineScope.launch(Dispatchers.IO) {
            while (true) {
                if (reader.ready()) {
                    val line = reader.readLine()
                    if (line.isNotEmpty()) {
                        try {
                            handleMessage(line)
                        } catch (e: Exception) {
                            service<ContinueErrorService>().report(e, "Error handling message: $line")
                        }
                    }
                } else
                    delay(100)
            }
        }
        coroutineScope.launch(Dispatchers.IO) {
            for (message in pendingWrites) {
                writer.write(message)
                writer.write("\r\n")
                writer.flush()
            }
        }
    }

    fun write(message: String) =
        pendingWrites.trySend(message)

    fun close() {
        reader.close()
        writer.close()
        process.close()
    }

}