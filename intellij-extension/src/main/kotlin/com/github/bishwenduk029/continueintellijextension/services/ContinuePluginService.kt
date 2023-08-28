package com.github.bishwenduk029.continueintellijextension.services

import com.github.bishwenduk029.continueintellijextension.toolWindow.ContinuePluginToolWindowFactory
import com.intellij.openapi.Disposable
import com.intellij.openapi.components.Service
import com.intellij.openapi.project.Project
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

@Service(Service.Level.PROJECT)
class ContinuePluginService(project: Project) : Disposable {
    val coroutineScope = CoroutineScope(Dispatchers.Main)
    val continuePluginWindow = ContinuePluginToolWindowFactory.ContinuePluginWindow(project)

    override fun dispose() {
        coroutineScope.cancel()
    }

    fun launchInScope(block: suspend CoroutineScope.() -> Unit) {
        coroutineScope.launch {
            block()
        }
    }
}