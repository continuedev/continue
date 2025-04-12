package com.github.continuedev.continueintellijextension.toolWindow

import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory
import javax.swing.*

const val JS_QUERY_POOL_SIZE = "200"

class ContinuePluginToolWindowFactory : ToolWindowFactory, DumbAware {
  override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
    val continueToolWindow = ContinuePluginWindow(project)
    val content =
        ContentFactory.getInstance().createContent(continueToolWindow.content, null, false)
    toolWindow.contentManager.addContent(content)
    val titleActions = mutableListOf<AnAction>()
    createTitleActions(titleActions)

    // Add MaximizeToolWindow action
    val action = ActionManager.getInstance().getAction("MaximizeToolWindow")
    if (action != null) {
      titleActions.add(action)
    }

    toolWindow.setTitleActions(titleActions)
  }

  private fun createTitleActions(titleActions: MutableList<in AnAction>) {
    val action = ActionManager.getInstance().getAction("ContinueSidebarActionsGroup")
    if (action != null) {
      titleActions.add(action)
    }
  }

  override fun shouldBeAvailable(project: Project) = true

  class ContinuePluginWindow(project: Project) {
    private val defaultGUIUrl = "http://continue/index.html"

    init {
      System.setProperty("ide.browser.jcef.jsQueryPoolSize", JS_QUERY_POOL_SIZE)
      System.setProperty("ide.browser.jcef.contextMenu.devTools.enabled", "true")
    }

    val browser: ContinueBrowser by lazy {
      val url = System.getenv("GUI_URL")?.toString() ?: defaultGUIUrl

      val browser = ContinueBrowser(project, url)
      val continuePluginService =
          ServiceManager.getService(project, ContinuePluginService::class.java)
      continuePluginService.continuePluginWindow = this
      browser
    }

    val content: JComponent
      get() = browser.browser.component
  }
}
