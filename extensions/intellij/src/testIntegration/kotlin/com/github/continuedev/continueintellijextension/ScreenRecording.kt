package com.github.continuedev.continueintellijextension

import org.junit.jupiter.api.extension.AfterTestExecutionCallback
import org.junit.jupiter.api.extension.BeforeTestExecutionCallback
import org.junit.jupiter.api.extension.ExtendWith
import org.junit.jupiter.api.extension.ExtensionContext
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * Records the X display with FFmpeg while the test runs and keeps the video
 * (video/<Class>.<method>.mp4, which CI uploads on failure) only when the test
 * fails. Does nothing without `ffmpeg` on the PATH or a DISPLAY, so local runs
 * are unaffected.
 *
 * Replaces com.automation-remarks:video-recorder-junit5, which is no longer
 * maintained and brought log4j 1.2.17 and commons-lang3 3.8.1 onto the test
 * classpath.
 */
@Target(AnnotationTarget.FUNCTION, AnnotationTarget.CLASS)
@Retention(AnnotationRetention.RUNTIME)
@ExtendWith(ScreenRecordingExtension::class)
annotation class RecordScreen

class ScreenRecordingExtension : BeforeTestExecutionCallback, AfterTestExecutionCallback {
    private val namespace = ExtensionContext.Namespace.create(ScreenRecordingExtension::class.java)

    private class Recording(val process: Process, val file: File)

    override fun beforeTestExecution(context: ExtensionContext) {
        val display = System.getenv("DISPLAY")?.takeIf { it.isNotBlank() } ?: return
        if (!ffmpegAvailable()) return

        val dir = File("video").apply { mkdirs() }
        val name = "${context.requiredTestClass.simpleName}.${context.requiredTestMethod.name}"
        val file = File(dir, "$name.mp4")
        val process = try {
            ProcessBuilder(
                "ffmpeg", "-y", "-loglevel", "error",
                // x11grab records the whole display when no size is given.
                "-f", "x11grab", "-framerate", "10", "-i", display,
                "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
                file.path,
            )
                .redirectErrorStream(true)
                .redirectOutput(File(dir, "$name.ffmpeg.log"))
                .start()
        } catch (e: Exception) {
            println("Screen recording not started: ${e.message}")
            return
        }
        context.getStore(namespace).put(context.uniqueId, Recording(process, file))
    }

    override fun afterTestExecution(context: ExtensionContext) {
        val recording = context.getStore(namespace)
            .remove(context.uniqueId, Recording::class.java) ?: return
        stop(recording.process)
        val log = File(recording.file.parentFile, recording.file.nameWithoutExtension + ".ffmpeg.log")
        if (context.executionException.isPresent) {
            println("Screen recording of the failed test: ${recording.file.absolutePath}")
        } else {
            recording.file.delete()
            log.delete()
        }
    }

    /** Ask FFmpeg to finish the file ("q"), then make sure it is gone. */
    private fun stop(process: Process) {
        try {
            process.outputStream.use { it.write('q'.code); it.flush() }
        } catch (_: Exception) {
            // FFmpeg already exited.
        }
        if (!process.waitFor(15, TimeUnit.SECONDS)) {
            process.destroy()
            if (!process.waitFor(5, TimeUnit.SECONDS)) process.destroyForcibly()
        }
    }

    private fun ffmpegAvailable(): Boolean = try {
        val process = ProcessBuilder("ffmpeg", "-version")
            .redirectErrorStream(true)
            .redirectOutput(ProcessBuilder.Redirect.DISCARD)
            .start()
        process.waitFor(10, TimeUnit.SECONDS) && process.exitValue() == 0
    } catch (_: Exception) {
        false
    }
}
