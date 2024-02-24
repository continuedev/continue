package com.github.continuedev.continueintellijextension.actions

import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.google.gson.Gson
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.components.ServiceManager
 import com.intellij.openapi.ui.DialogWrapper
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.wm.ToolWindowManager
import java.awt.Dimension
import javax.swing.*
import javax.swing.event.DocumentEvent
import javax.swing.event.DocumentListener
import com.intellij.ui.components.JBScrollPane
import java.awt.BorderLayout

fun pluginServiceFromActionEvent(e: AnActionEvent): ContinuePluginService? {
    val project = e.project ?: return null
    return ServiceManager.getService(
            project,
            ContinuePluginService::class.java
    )
}

class AcceptDiffAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val continuePluginService = pluginServiceFromActionEvent(e) ?: return
        continuePluginService.ideProtocolClient?.diffManager?.acceptDiff(null)
    }
}

class RejectDiffAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val continuePluginService = pluginServiceFromActionEvent(e) ?: return
        continuePluginService.ideProtocolClient?.diffManager?.rejectDiff(null)
    }
}


 class QuickInputDialogWrapper : DialogWrapper(true) {
     private var panel: JPanel? = null
    private var textArea: JTextArea? = null
     init {
         init()
         title = "Continue Quick Input"
     }

     override fun getPreferredFocusedComponent(): JComponent? {
         return textArea
     }

     override fun createCenterPanel(): JComponent? {
         panel = JPanel(BorderLayout())
         textArea = JTextArea(3, 60)
         textArea?.lineWrap = true
         textArea?.wrapStyleWord = true

        // Add a DocumentListener to the JTextArea
         textArea?.document?.addDocumentListener(object : DocumentListener {
             override fun insertUpdate(e: DocumentEvent?) {
                 updateSize()
             }

             override fun removeUpdate(e: DocumentEvent?) {
                 updateSize()
             }

             override fun changedUpdate(e: DocumentEvent?) {
                 updateSize()
             }

             private fun updateSize() {
                 val text = textArea?.text ?: ""
                 val lines = text.count { it == '\n' } + 1
                 val metrics = textArea?.getFontMetrics(textArea?.font)
                 val lineHeight = metrics?.height ?: 0
                 textArea?.preferredSize = Dimension(textArea?.width ?: 0, lines * lineHeight)

                 // Revalidate the JPanel to reflect the changes
                 panel?.revalidate()
             }
         })

          val scrollPane = JBScrollPane(textArea)
          scrollPane.verticalScrollBarPolicy = JScrollPane.VERTICAL_SCROLLBAR_ALWAYS
          panel?.add(scrollPane, BorderLayout.CENTER)
         
          return panel
     }


     fun showDialogAndGetText(): String? {
         show()
         return if (this.exitCode == OK_EXIT_CODE) {
             textArea!!.text
         } else {
             null
         }
     }
 }


class QuickTextEntryAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val continuePluginService = pluginServiceFromActionEvent(e) ?: return
        continuePluginService.ideProtocolClient?.sendHighlightedCode()

         // Create and show the dialog
         val dialog = QuickInputDialogWrapper()
         val text: String? = dialog.showDialogAndGetText()

         // Show the text entered by the user
         if (text != null) {
             val service = pluginServiceFromActionEvent(e)
             service?.ideProtocolClient?.sendMainUserInput(text)

             val project = e.project
             if (project != null) {
                 val toolWindowManager = ToolWindowManager.getInstance(project)
                 val toolWindow = toolWindowManager.getToolWindow("Continue")

                 if (toolWindow != null) {
                     if (!toolWindow.isVisible) {
                         toolWindow.activate(null)
                     }
                 }
             }

             continuePluginService.continuePluginWindow?.content?.components?.get(0)?.requestFocus()
             continuePluginService.sendToWebview("focusContinueInput", null)

         }
    }
}

class ViewLogsAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        Messages.showMessageDialog(
            "This action is not yet implemented",
            "Continue Action not Implemented",
            Messages.getInformationIcon()
        )
    }
}

class ToggleAuxiliaryBarAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val toolWindowManager = ToolWindowManager.getInstance(project)
        val toolWindow = toolWindowManager.getToolWindow("Continue")

        if (toolWindow != null) {
            if (toolWindow.isVisible) {
                toolWindow.component.transferFocus()
                toolWindow.hide(null)
            } else {
                toolWindow.activate(null)
            }
        }
    }
}

class FocusContinueInputWithoutClearAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project
        if (project != null) {
            val toolWindowManager = ToolWindowManager.getInstance(project)
            val toolWindow = toolWindowManager.getToolWindow("Continue")

            if (toolWindow != null) {
                if (!toolWindow.isVisible) {
                    toolWindow.activate(null)
                }
            }
        }

        val continuePluginService = pluginServiceFromActionEvent(e) ?: return
        continuePluginService.continuePluginWindow?.content?.components?.get(0)?.requestFocus()
        continuePluginService.sendToWebview("focusContinueInputWithoutClear", null)

        continuePluginService.ideProtocolClient?.sendHighlightedCode()
    }
}

class FocusContinueInputAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project
        if (project != null) {
            val toolWindowManager = ToolWindowManager.getInstance(project)
            val toolWindow = toolWindowManager.getToolWindow("Continue")

            if (toolWindow != null) {
                if (!toolWindow.isVisible) {
                    toolWindow.activate(null)
                }
            }
        }

        val continuePluginService = pluginServiceFromActionEvent(e) ?: return

        continuePluginService.continuePluginWindow?.content?.components?.get(0)?.requestFocus()
        continuePluginService.sendToWebview("focusContinueInput", null)

        continuePluginService.ideProtocolClient?.sendHighlightedCode()
    }
}

class NewContinueSessionAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project
        if (project != null) {
            val toolWindowManager = ToolWindowManager.getInstance(project)
            val toolWindow = toolWindowManager.getToolWindow("Continue")

            if (toolWindow != null) {
                if (!toolWindow.isVisible) {
                    toolWindow.activate(null)
                }
            }
        }

        val continuePluginService = pluginServiceFromActionEvent(e) ?: return

        continuePluginService.continuePluginWindow?.content?.components?.get(0)?.requestFocus()
        continuePluginService.sendToWebview("focusContinueInputWithNewSession", null)
    }
}

class ViewHistoryAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project
        if (project != null) {
            val toolWindowManager = ToolWindowManager.getInstance(project)
            val toolWindow = toolWindowManager.getToolWindow("Continue")
        }

        val continuePluginService = pluginServiceFromActionEvent(e) ?: return

        continuePluginService.sendToWebview("viewHistory", null)
    }
}