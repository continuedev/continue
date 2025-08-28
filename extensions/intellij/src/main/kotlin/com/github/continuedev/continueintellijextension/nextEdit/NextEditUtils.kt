package com.github.continuedev.continueintellijextension.nextEdit

import com.github.continuedev.continueintellijextension.FimResult
import com.github.continuedev.continueintellijextension.auth.ContinueAuthService
import com.github.continuedev.continueintellijextension.`continue`.ProfileInfoService
import com.github.continuedev.continueintellijextension.utils.castNestedOrNull
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project

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


object NextEditUtils {
    suspend fun isNextEditSupported(project: Project): Boolean {
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

    /**
     * Check if the diff is indeed a FIM (Fill-In-Middle).
     * @param oldEditRange Original string content.
     * @param newEditRange New string content.
     * @param cursorPosition The position of the cursor in the old string.
     * @return A Pair where the first value is a boolean indicating if the change is purely additive (FIM)
     *         and the second value is the FIM text content or null if not a FIM.
     */
    fun checkFim(
        oldEditRange: String,
        newEditRange: String,
        cursorPosition: Pair<Int, Int> // line, character
    ): FimResult {
        // Find the common prefix
        var prefixLength = 0
        while (prefixLength < oldEditRange.length &&
            prefixLength < newEditRange.length &&
            oldEditRange[prefixLength] == newEditRange[prefixLength]
        ) {
            prefixLength++
        }

        // Find the common suffix
        var oldSuffixPos = oldEditRange.length - 1
        var newSuffixPos = newEditRange.length - 1

        while (oldSuffixPos >= prefixLength &&
            newSuffixPos >= prefixLength &&
            oldEditRange[oldSuffixPos] == newEditRange[newSuffixPos]
        ) {
            oldSuffixPos--
            newSuffixPos--
        }

        // The old text is purely preserved if:
        // 1. The prefix ends before or at the cursor.
        // 2. The suffix starts after or at the cursor.
        // 3. There's no gap between prefix and suffix in the old text.

        val suffixStartInOld = oldSuffixPos + 1
        val suffixStartInNew = newSuffixPos + 1

        // Convert cursor position to an offset in the string.
        // For simplicity, we need to calculate the cursor's position in the string.
        // This requires knowledge of line endings in the oldEditRange.
        val lines = oldEditRange.substring(0, prefixLength).split("\n")
        val cursorOffset = if (lines.size > 1) {
            lines.dropLast(1).sumOf { it.length + 1 } + cursorPosition.second
        } else {
            cursorPosition.second
        }

        // Check if the cursor is positioned between the prefix and suffix.
        val cursorBetweenPrefixAndSuffix =
            prefixLength <= cursorOffset && cursorOffset <= suffixStartInOld

        // Check if the old text is completely preserved (no deletion).
        val noTextDeleted = suffixStartInOld - prefixLength <= 0

        val isFim = cursorBetweenPrefixAndSuffix && noTextDeleted

        return if (isFim) {
            // Extract the content between prefix and suffix in the new string.
            FimResult.FimEdit(newEditRange.substring(prefixLength, suffixStartInNew))
        } else {
            FimResult.NotFimEdit
        }
    }
}