package com.github.continuedev.continueintellijextension.license

import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.DialogWrapper
import com.intellij.openapi.ui.ValidationInfo
import com.intellij.ui.dsl.builder.AlignX
import com.intellij.ui.dsl.builder.bindText
import com.intellij.ui.dsl.builder.panel
import javax.swing.JComponent

class AddLicenseKeyDialog(project: Project?) : DialogWrapper(project) {

    var licenseKey: String = ""
        private set

    init {
        title = "Enterprise License Key"
        init()
    }

    override fun createCenterPanel(): JComponent? =
        panel {
            row {
                textField().bindText(::licenseKey)
                    .align(AlignX.FILL)
                    .focused()
                    .validationOnApply {
                        if (it.text.isBlank())
                            ValidationInfo("License key cannot be empty")
                        else
                            null
                    }
            }
        }
}