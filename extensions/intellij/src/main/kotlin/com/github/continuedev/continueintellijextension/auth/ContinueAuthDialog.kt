package com.github.continuedev.continueintellijextension.auth

import com.intellij.openapi.ui.DialogWrapper
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBTextField
import com.intellij.ui.HyperlinkLabel
import javax.swing.JComponent
import javax.swing.JPanel
import java.awt.BorderLayout
import javax.swing.BoxLayout

class ContinueAuthDialog(
    private val useOnboarding: Boolean,
    private val authUrl: String? = null,
    private val onTokenEntered: (String) -> Unit,
) : DialogWrapper(true) {
    private val tokenField = JBTextField()

    init {
        init()
        title = "Continue authentication"
    }

    override fun createCenterPanel(): JComponent {
        val panel = JPanel(BorderLayout())
        val topPanel = JPanel()
        topPanel.layout = BoxLayout(topPanel, BoxLayout.Y_AXIS)

        val message =
            if (useOnboarding) "After onboarding you will be shown an authentication token. Please enter it here:" else "Please enter your Continue authentication token:"
        topPanel.add(JBLabel(message))
        topPanel.add(javax.swing.Box.createVerticalStrut(10))

        if (authUrl != null) {
            val linkLabel = HyperlinkLabel("Open authentication page")
            linkLabel.setHyperlinkTarget(authUrl)
            topPanel.add(linkLabel)
            topPanel.add(javax.swing.Box.createVerticalStrut(10))
        }

        panel.add(topPanel, BorderLayout.NORTH)
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
