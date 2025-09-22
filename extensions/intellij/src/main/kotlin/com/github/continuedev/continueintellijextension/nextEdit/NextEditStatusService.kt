package com.github.continuedev.continueintellijextension.nextEdit

import com.github.continuedev.continueintellijextension.auth.ContinueAuthService
import com.github.continuedev.continueintellijextension.`continue`.ProfileInfoService
import com.github.continuedev.continueintellijextension.utils.castNestedOrNull
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.text.endsWith

/**
 * This cache-like service is introduced to enable checking the Next Edit status in a non-blocking way (e.g., while
 * moving the cursor/selection or triggering autocompletion).
 *
 * Checking this status is problematic on the EDT because it requires making a request to the binary (settings JSON)
 * and decrypting the username from the PasswordSafe, which is considered a _slow operation_.
 */
@Service(Service.Level.PROJECT)
class NextEditStatusService(private val project: Project) {

    @Volatile
    private var isEnabledLastValue: Boolean = false
    private val updateInProgress = AtomicBoolean(false)
    private val scope = CoroutineScope(Dispatchers.Default)

    fun isNextEditEnabled(): Boolean {
        if (updateInProgress.compareAndSet(false, true))
            scope.launch {
                try {
                    isEnabledLastValue = isNextEditEnabledAsync(project)
                } catch (_: Exception) {
                } finally {
                    updateInProgress.set(false)
                }
            }
        return isEnabledLastValue
    }

    // The code below is copied from NextEditUtils
    // -------------------------------------------

    private suspend fun isNextEditEnabledAsync(project: Project): Boolean {
        return try {
            // NOTE: Quick filter for non-continue users.
            // Remove this once we have a FIM - Next Edit toggle UI.
            val authService = project.service<ContinueAuthService>()
            val sessionInfo = authService.loadControlPlaneSessionInfo()
            val userEmail = sessionInfo?.account?.id

            if (userEmail == null || !userEmail.endsWith("@continue.dev")) {
                return false
            }

            val profileInfoService = project.service<ProfileInfoService>()
            val selectedModelByRole = profileInfoService.fetchSelectedModelByRoleOrNull()

            // Use the existing utility function
            val autocompleteModel = selectedModelByRole?.get("autocomplete").castNestedOrNull<Map<String, Any>>()

            if (autocompleteModel != null) {
                val modelName = autocompleteModel["model"] as? String ?: ""
                val title = autocompleteModel["title"] as? String
                val capabilities = autocompleteModel["capabilities"].castNestedOrNull<Map<String, Any>>()

                isNextEditModel(modelName, title, capabilities)
            } else {
                false
            }
        } catch (e: Exception) {
            println("Error checking Next Edit support: ${e.message}")
            false
        }
    }

    private fun isNextEditModel(
        model: String,
        title: String?,
        capabilities: Map<String, Any>?
    ): Boolean {
        // Check capabilities first - this takes precedence.
        val hasNextEditCapability = capabilities?.get("nextEdit") as? Boolean ?: false

        // Check model name and title against known Next Edit models.
        return hasNextEditCapability || NextEditModelMatcher.isSupported(model, title)
    }

    sealed class NextEditModelMatcher {
        abstract fun matches(modelName: String?, title: String?): Boolean

        data object MercuryCoder : NextEditModelMatcher() {
            override fun matches(modelName: String?, title: String?): Boolean =
                modelName?.lowercase()?.contains("mercury-coder") == true ||
                        title?.lowercase()?.contains("mercury coder") == true
        }

        data object Instinct : NextEditModelMatcher() {
            override fun matches(modelName: String?, title: String?): Boolean =
                modelName?.lowercase()?.contains("instinct") == true ||
                        title?.lowercase()?.contains("instinct") == true
        }

        companion object {
            private val allMatchers = listOf(MercuryCoder, Instinct)

            fun isSupported(modelName: String?, title: String?): Boolean {
                return allMatchers.any { it.matches(modelName, title) }
            }
        }
    }

}