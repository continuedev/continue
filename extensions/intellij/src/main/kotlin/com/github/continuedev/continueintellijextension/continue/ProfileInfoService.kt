package com.github.continuedev.continueintellijextension.`continue`

import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.github.continuedev.continueintellijextension.utils.castNestedOrNull
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.time.Duration.Companion.seconds

@Service(Service.Level.PROJECT)
class ProfileInfoService(private val project: Project) {
    private val log = Logger.getInstance(ProfileInfoService::class.java)
    private var fallbackInfo: Any? = null // todo: add type + deserialize

    suspend fun fetchModelTimeoutOrNull() =
        fetchOrNull().castNestedOrNull<Double?>(
            "content",
            "result",
            "config",
            "tabAutocompleteOptions",
            "modelTimeout"
        )

    suspend fun fetchSelectedModelByRoleOrNull(): Map<String, Any>? =
        fetchOrNull().castNestedOrNull<Map<String, Any>>(
            "content",
            "result",
            "config",
            "selectedModelByRole"
        )

    suspend fun fetchModelsByRoleOrNull() =
        fetchOrNull().castNestedOrNull<Map<String, Any>>(
            "content",
            "result",
            "config",
            "modelsByRole"
        )

    private suspend fun fetchOrNull(): Any? {
        val actual = withTimeoutOrNull(1.seconds) {
            suspendCancellableCoroutine { continuation ->
                project.service<ContinuePluginService>().coreMessenger?.request(
                    "config/getSerializedProfileInfo",
                    null,
                    null
                ) { response ->
                    continuation.resumeWith(Result.success(response))
                }
            }
        }
        if (actual == null) {
            log.warn("Fall back to previous settings due to timeout")
            return fallbackInfo
        }
        fallbackInfo = actual
        return actual
    }

}