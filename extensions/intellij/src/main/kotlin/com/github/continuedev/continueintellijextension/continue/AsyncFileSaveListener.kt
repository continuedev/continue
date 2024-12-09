package com.github.continuedev.continueintellijextension.`continue`

import com.github.continuedev.continueintellijextension.constants.getConfigJsonPath
import com.google.gson.GsonBuilder
import com.google.gson.reflect.TypeToken
import com.intellij.openapi.vfs.AsyncFileListener
import com.intellij.openapi.vfs.newvfs.events.VFileEvent
import java.io.FileReader

class AsyncFileSaveListener(private val ideProtocolClient: IdeProtocolClient) : AsyncFileListener {
    private fun readConfigJson(): Map<String, Any> {
        val gson = GsonBuilder().setPrettyPrinting().create()
        val configJsonPath = getConfigJsonPath()
        val reader = FileReader(configJsonPath)
        val config: Map<String, Any> = gson.fromJson(
            reader,
            object : TypeToken<Map<String, Any>>() {}.type
        )
        reader.close()
        return config
    }
    
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
                        val config = readConfigJson()
                        ideProtocolClient.configUpdate()
                    }
                }
            }
        }
        return null
    }
}