package com.github.continuedev.continueintellijextension.`continue`.process

<<<<<<< HEAD
import com.github.continuedev.continueintellijextension.error.ContinueSentryService
import com.intellij.openapi.components.service
=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
import com.intellij.openapi.diagnostic.Logger
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import java.io.BufferedReader
import java.io.IOException
import java.io.InputStreamReader
import java.io.OutputStreamWriter

class ContinueProcessHandler(
    parentScope: CoroutineScope,
    private val process: ContinueProcess,
    handleMessage: (String) -> (Unit)
) {
    private val innerJob = Job()
    private val scope = CoroutineScope(parentScope.coroutineContext + innerJob)
    private val pendingWrites = Channel<String>(Channel.UNLIMITED)
    private val writer = OutputStreamWriter(process.output)
    private val reader = BufferedReader(InputStreamReader(process.input))
    private val log = Logger.getInstance(ContinueProcessHandler::class.java)

    init {
        scope.launch(Dispatchers.IO) {
            try {
                while (isActive) {
                    val line = reader.readLine()
                    if (line != null && line.isNotEmpty()) {
                        try {
                            log.debug("Handle: $line")
                            handleMessage(line)
                        } catch (e: Exception) {
<<<<<<< HEAD
                            service<ContinueSentryService>().report(e, "Error handling message: $line")
=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
                        }
                    } else
                        delay(100)
                }
            } catch (e: IOException) {
<<<<<<< HEAD
                service<ContinueSentryService>().report(e)
=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
            }
        }
        scope.launch(Dispatchers.IO) {
            for (message in pendingWrites) {
                try {
                    log.debug("Write: $message")
                    writer.write(message)
                    writer.write("\r\n")
                    writer.flush()
                } catch (e: IOException) {
                    log.warn(e)
                }
            }
        }
    }

    fun write(message: String) =
        pendingWrites.trySend(message)

    fun close() {
        innerJob.cancel()
        scope.launch(Dispatchers.IO) {
            reader.close()
            writer.close()
            process.close()
        }
    }
}
