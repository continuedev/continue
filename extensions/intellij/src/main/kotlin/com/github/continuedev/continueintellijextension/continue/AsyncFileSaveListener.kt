package com.github.continuedev.continueintellijextension.`continue`

import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.intellij.openapi.vfs.AsyncFileListener
import com.intellij.openapi.vfs.newvfs.events.VFileEvent

class AsyncFileSaveListener(private val continuePluginService: ContinuePluginService) : AsyncFileListener {
    private val configFilePatterns = listOf(
        ".continue/config.json",
        ".continue/config.ts",
        ".continue/config.yaml",
        ".continuerc.json"
    )

    override fun prepareChange(events: MutableList<out VFileEvent>): AsyncFileListener.ChangeApplier? {
        val isConfigFile = events.any { event ->
            configFilePatterns.any { pattern ->
                event.path.endsWith(pattern) || event.path.endsWith(pattern.replace("/", "\\"))
            }
        }

        return if (isConfigFile) {
            object : AsyncFileListener.ChangeApplier {
                override fun afterVfsChange() {
                    continuePluginService.coreMessenger?.request("config/reload", null, null) { _ -> }
                }
            }
        } else null
    }
}