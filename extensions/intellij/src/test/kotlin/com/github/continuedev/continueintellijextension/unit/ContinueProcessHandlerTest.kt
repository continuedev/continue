package com.github.continuedev.continueintellijextension.unit

import com.github.continuedev.continueintellijextension.`continue`.process.ContinueProcess
import com.github.continuedev.continueintellijextension.`continue`.process.ContinueProcessHandler
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.joinAll
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.RepeatedTest
import java.io.InputStream
import java.io.OutputStream

class ContinueProcessHandlerTest {

    @RepeatedTest(5)
    fun `test concurrent writes with queue`() = runTest {
        val process = StringContinueProcess()
        val handler = ContinueProcessHandler(this, process) {}

        (0..100).map { i -> launch(Dispatchers.Default) { handler.write("message number $i") } }
            .joinAll()

        handler.close()

        // assert all message lines are present (order not important)
        val lines = process.string.split("\r\n").filter { it.isNotBlank() }
        for (i in 0..100)
            Assertions.assertTrue(lines.contains("message number $i"))

        // note: this test will fail if the handler writes messages directly to the output stream
        // this problem can be easily reproduced by removing the channel<string> from the handler code
    }

    class StringContinueProcess : ContinueProcess {
        val string = StringBuilder()
        override val input: InputStream = InputStream.nullInputStream()
        override val output: OutputStream = object : OutputStream() {
            override fun write(b: Int) {
                string.append(b.toChar())
            }

            override fun write(b: ByteArray, off: Int, len: Int) {
                string.append(String(b, off, len))
            }
        }

        override fun close() {
        }
    }
}