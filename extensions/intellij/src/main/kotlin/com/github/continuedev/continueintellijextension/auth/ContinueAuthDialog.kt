package com.github.continuedev.continueintellijextension.auth

import com.intellij.openapi.ui.DialogWrapper
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBTextField
import javax.swing.JComponent
import javax.swing.JPanel
import java.awt.BorderLayout

class ContinueAuthDialog(private val onTokenEntered: (String) -> Unit) : DialogWrapper(true) {
    private val tokenField = JBTextField()

    init {
        init()
        title = "Continue authentication"
    }

    override fun createCenterPanel(): JComponent {
        val panel = JPanel(BorderLayout())
        panel.add(JBLabel("Please enter your Continue authentication token:"), BorderLayout.NORTH)
        panel.add(tokenField, BorderLayout.CENTER)
        return panel
    }

    override fun doOKAction() {
        val token = tokenField.text
        if (token.isNotBlank()) {
            onTokenEntered(token)
            super.doOKAction()
        } else {
            setErrorText("Please enter a valid token")
        }
    }
}
