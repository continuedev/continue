package com.github.continuedev.continueintellijextension.editor

import com.intellij.openapi.components.Service
import com.intellij.openapi.editor.Editor

@Service(Service.Level.PROJECT)
class DiffStreamService {
    private val handlers = mutableMapOf<Editor, DiffStreamHandler>()

    fun register(handler: DiffStreamHandler, editor: Editor) {
        if (handlers.containsKey(editor)) {
            handlers[editor]?.rejectAll()
        }
        handlers[editor] = handler
        //println("Registered handler for editor")
    }

    fun reject(editor: Editor) {
        handlers[editor]?.rejectAll()
        handlers.remove(editor)
    }

    fun accept(editor: Editor) {
        handlers[editor]?.acceptAll()
        handlers.remove(editor)
    }
}