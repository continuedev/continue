package com.github.continuedev.continueintellijextension.editor

import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.intellij.openapi.components.service
import com.intellij.openapi.ide.CopyPasteManager
import com.intellij.openapi.ide.CopyPasteManager.ContentChangedListener
import java.awt.datatransfer.DataFlavor

class ContinueCopyListener : ContentChangedListener {
    override fun contentChanged(content: Any?) {
        try {
            val copyPasteManager = CopyPasteManager.getInstance()
            val transferData = copyPasteManager.contents?.getTransferData(DataFlavor.stringFlavor)
            if (transferData is String && transferData.isNotEmpty()) {
                val continuePluginService = service<ContinuePluginService>()
                continuePluginService.coreMessenger?.request(
                    "clipboardCache/add",
                    mapOf("content" to transferData),
                    null
                ) { _ -> }
            }
        } catch (e: Exception) {
            System.out.println("Failed to send copy event");
        }
    }
    // public void init() {
    //     CopyPasteManager.getInstance().addContentChangedListener(content -> {
    //         // Handle clipboard content change here
    //         String text = CopyPasteManager.getInstance()
    //                 .getContents(DataFlavor.stringFlavor);
    //         if (text != null) {
    //             System.out.println("Clipboard changed: " + text);
    //         }
    //     });
    // }

    // public void dispose() {
    //     // Remove listener when done
    //     CopyPasteManager.getInstance().removeContentChangedListener(null);
    // }
}