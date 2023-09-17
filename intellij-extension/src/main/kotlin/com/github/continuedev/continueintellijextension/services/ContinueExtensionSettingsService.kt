package com.github.continuedev.continueintellijextension.services

import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.openapi.options.Configurable
import java.awt.GridBagConstraints
import java.awt.GridBagLayout
import javax.swing.JCheckBox
import javax.swing.JComponent
import javax.swing.JLabel
import javax.swing.JPanel
import javax.swing.JTextField

class ContinueSettingsComponent {
    val panel: JPanel = JPanel(GridBagLayout())
    private val myTextField: JTextField = JTextField()
    private val myCheckBox: JCheckBox =
        JCheckBox("Manually Running Continue Server")

    init {
        val constraints = GridBagConstraints()

        constraints.fill = GridBagConstraints.HORIZONTAL
        constraints.weightx = 1.0
        constraints.weighty = 0.0
        constraints.gridx = 0
        constraints.gridy = GridBagConstraints.RELATIVE

        val serverURLLabel = JLabel("Server URL")
        panel.add(serverURLLabel, constraints)

        panel.add(myTextField, constraints)

        val runningServerLabel = JLabel("Manually Running Server")
        panel.add(runningServerLabel, constraints)

        panel.add(myCheckBox, constraints)

        // Add a "filler" component that takes up all remaining vertical space
        constraints.weighty = 1.0
        val filler = JPanel()
        panel.add(filler, constraints)

    }

    var serverUrl: String?
        get() = myTextField.text
        set(newText) {
            myTextField.text = newText
        }

    var manuallyRunningServer: Boolean
        get() = myCheckBox.isSelected
        set(value) {
            myCheckBox.isSelected = value
        }
}

@State(
    name = "com.github.continuedev.continueintellijextension.services.ContinueExtensionSettings",
    storages = [Storage("ContinueExtensionSettings.xml")]
)
class ContinueExtensionSettings :
    PersistentStateComponent<ContinueExtensionSettings.State> {

    var serverUrl: String? = null
    var manuallyRunningServer: Boolean = false

    override fun getState(): State {
        return State(serverUrl, manuallyRunningServer)
    }

    override fun loadState(state: State) {
        serverUrl = state.serverUrl
        manuallyRunningServer = state.manuallyRunningServer
    }

    data class State(var serverUrl: String?, var manuallyRunningServer: Boolean)
}

class ContinueExtensionConfigurable : Configurable {
    private var mySettingsComponent: ContinueSettingsComponent? = null

    override fun createComponent(): JComponent {
        mySettingsComponent = ContinueSettingsComponent()
        return mySettingsComponent!!.panel
    }

    override fun isModified(): Boolean {
        val settings =
            ServiceManager.getService(ContinueExtensionSettings::class.java)
        return mySettingsComponent!!.serverUrl != settings.serverUrl || mySettingsComponent!!.manuallyRunningServer != settings.manuallyRunningServer
    }

    override fun apply() {
        val settings =
            ServiceManager.getService(ContinueExtensionSettings::class.java)
        settings.serverUrl = mySettingsComponent!!.serverUrl
        settings.manuallyRunningServer =
            mySettingsComponent!!.manuallyRunningServer
    }

    override fun reset() {
        val settings =
            ServiceManager.getService(ContinueExtensionSettings::class.java)
        mySettingsComponent!!.serverUrl = settings.serverUrl
        mySettingsComponent!!.manuallyRunningServer =
            settings.manuallyRunningServer
    }

    override fun disposeUIResources() {
        mySettingsComponent = null
    }

    override fun getDisplayName(): String {
        return "My Extension"
    }
}
