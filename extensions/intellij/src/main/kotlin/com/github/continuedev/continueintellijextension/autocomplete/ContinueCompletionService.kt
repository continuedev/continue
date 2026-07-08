package com.github.continuedev.continueintellijextension.autocomplete

import com.github.continuedev.continueintellijextension.`continue`.ProfileInfoService
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.github.continuedev.continueintellijextension.utils.castNestedOrNull
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.time.Duration.Companion.milliseconds

@Service(Service.Level.PROJECT)
class ContinueCompletionService(private val project: Project) : CompletionService {

    override suspend fun getAutocomplete(uuid: String, url: String, line: Int, column: Int): String? {
        val requestInput = getCompletionInput(uuid, url, line, column)
        val modelTimeout = project.service<ProfileInfoService>().fetchModelTimeoutOrNull() ?: 1000.0
        return withTimeoutOrNull(modelTimeout.milliseconds * 3) {
            suspendCancellableCoroutine { continuation ->
                project.service<ContinuePluginService>().coreMessenger?.request(
                    "autocomplete/complete",
                    requestInput,
                    null
                ) {
                    val content = it.castNestedOrNull<List<String>>("content")?.firstOrNull() ?: ""
                    continuation.resumeWith(Result.success(content))
                }
            }
        }
    }

    override fun acceptAutocomplete(uuid: String?) {
        project.service<ContinuePluginService>().coreMessenger?.request(
            "autocomplete/accept",
            mapOf("completionId" to uuid),
            null
        ) {}
    }

    private fun getCompletionInput(uuid: String, filepath: String, line: Int, character: Int): Map<String, *> = mapOf(
        "completionId" to uuid,
        "filepath" to filepath,
        "pos" to mapOf(
            "line" to line,
            "character" to character
        ),
        "clipboardText" to "",
        "recentlyEditedRanges" to emptyList<Any>(),
        "recentlyVisitedRanges" to emptyList<Any>(),
    )

}