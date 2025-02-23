package com.github.continuedev.continueintellijextension.services

//import com.intellij.openapi.components.Service
//import com.intellij.openapi.project.Project
//import com.intellij.terminal.JBTerminalWidget
//import com.jetbrains.rd.util.CopyOnWriteArrayList
//import org.jetbrains.plugins.terminal.TerminalView
//
//@Service(Service.Level.PROJECT)
//class TerminalActivityTrackingService(private val project: Project) {
//    private val activeTerminalWidgets: MutableList<JBTerminalWidget> = CopyOnWriteArrayList()
//
//    fun update(widgets: Collection<JBTerminalWidget>) {
//        activeTerminalWidgets.retainAll(widgets)
//        val focus = TerminalView.getInstance(project).widgets.filter { it.isShowing && it.terminalPanel.hasFocus() }
//        if (focus.isNotEmpty()) {
//            assert(focus.size == 1)
//            val widget = focus.first()
//            if (activeTerminalWidgets.lastOrNull() != widget) {
//                activeTerminalWidgets.run {
//                    remove(widget)
//                    add(widget)
//                }
//            }
//        }
//    }
//
//    fun latest() = activeTerminalWidgets.lastOrNull()
//}