package com.github.continuedev.continueintellijextension.`continue`

import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.intellij.openapi.vfs.AsyncFileListener
import com.intellij.openapi.vfs.newvfs.events.VFileEvent

class AsyncFileSaveListener(private val continuePluginService: ContinuePluginService) : AsyncFileListener {
    override fun prepareChange(events: MutableList<out VFileEvent>): AsyncFileListener.ChangeApplier? {
        for (event in events) {
            if (event.path.endsWith(".continue/config.json") || event.path.endsWith(".continue/config.ts") || event.path.endsWith(
                    ".continue\\config.json"
                ) || event.path.endsWith(".continue\\config.ts") || event.path.endsWith(".continuerc.json") || event.path.endsWith(
                    ".continuerc.json"
                )
            ) {
                return object : AsyncFileListener.ChangeApplier {
                    override fun afterVfsChange() {
                        continuePluginService.coreMessenger?.request("config/reload", null, null) { _ -> }
                    }
                }
            }
        }
        return null
    }
}