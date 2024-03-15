package com.github.continuedev.continueintellijextension.services

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.openapi.options.Configurable
import com.intellij.openapi.project.DumbAware
import com.intellij.util.messages.Topic
import java.awt.GridBagConstraints
import java.awt.GridBagLayout
import javax.swing.JCheckBox
import javax.swing.JComponent
import javax.swing.JLabel
import javax.swing.JPanel
import javax.swing.JTextField

class ContinueSettingsComponent: DumbAware {
    val panel: JPanel = JPanel(GridBagLayout())
    val remoteConfigServerUrl: JTextField = JTextField()
    val remoteConfigSyncPeriod: JTextField = JTextField()
    val userToken: JTextField = JTextField()
    val enableTabAutocomplete: JCheckBox = JCheckBox("Enable Tab Autocomplete")

    init {
        val constraints = GridBagConstraints()

        constraints.fill = GridBagConstraints.HORIZONTAL
        constraints.weightx = 1.0
        constraints.weighty = 0.0
        constraints.gridx = 0
        constraints.gridy = GridBagConstraints.RELATIVE

        panel.add(JLabel("Remote Config Server URL:"), constraints)
        constraints.gridy++
        constraints.gridy++
        panel.add(remoteConfigServerUrl, constraints)
        constraints.gridy++
        panel.add(JLabel("Remote Config Sync Period (in minutes):"), constraints)
        constraints.gridy++
        panel.add(remoteConfigSyncPeriod, constraints)
        constraints.gridy++
        panel.add(JLabel("User Token:"), constraints)
        constraints.gridy++
        panel.add(userToken, constraints)
        constraints.gridy++
        panel.add(enableTabAutocomplete, constraints)
        constraints.gridy++

        // Add a "filler" component that takes up all remaining vertical space
        constraints.weighty = 1.0
        val filler = JPanel()
        panel.add(filler, constraints)
    }
}

@State(
    name = "com.github.continuedev.continueintellijextension.services.ContinueExtensionSettings",
    storages = [Storage("ContinueExtensionSettings.xml")]
)
open class ContinueExtensionSettings : PersistentStateComponent<ContinueExtensionSettings.ContinueState> {

    class ContinueState {
        var shownWelcomeDialog: Boolean = false
        var remoteConfigServerUrl: String? = null
        var remoteConfigSyncPeriod: Int = 60
        var userToken: String? = null
        var enableTabAutocomplete: Boolean = false
    }

    var continueState: ContinueState = ContinueState()

    override fun getState(): ContinueState {
        return continueState
    }

    override fun loadState(state: ContinueState) {
        continueState = state
    }

    companion object {
        val instance: ContinueExtensionSettings
            get() = ServiceManager.getService(ContinueExtensionSettings::class.java)
    }
}

interface SettingsListener {
    fun settingsUpdated(settings: ContinueExtensionSettings.ContinueState)

    companion object {
        val TOPIC = Topic.create("SettingsUpdate", SettingsListener::class.java)
    }
}

class ContinueExtensionConfigurable : Configurable {
    private var mySettingsComponent: ContinueSettingsComponent? = null

    override fun createComponent(): JComponent {
        mySettingsComponent = ContinueSettingsComponent()
        return mySettingsComponent!!.panel
    }

    override fun isModified(): Boolean {
        val settings = ContinueExtensionSettings.instance
        val modified = mySettingsComponent?.remoteConfigServerUrl?.text != settings.continueState.remoteConfigServerUrl ||
                mySettingsComponent?.remoteConfigSyncPeriod?.text?.toInt() != settings.continueState.remoteConfigSyncPeriod ||
                mySettingsComponent?.userToken?.text != settings.continueState.userToken ||
                mySettingsComponent?.enableTabAutocomplete?.isSelected != settings.continueState.enableTabAutocomplete
        return modified;
    }

    override fun apply() {
        val settings = ContinueExtensionSettings.instance
        settings.continueState.remoteConfigServerUrl = mySettingsComponent?.remoteConfigServerUrl?.text
        settings.continueState.remoteConfigSyncPeriod = mySettingsComponent?.remoteConfigSyncPeriod?.text?.toInt() ?: 60
        settings.continueState.userToken = mySettingsComponent?.userToken?.text
        settings.continueState.enableTabAutocomplete = mySettingsComponent?.enableTabAutocomplete?.isSelected ?: false

        ApplicationManager.getApplication().messageBus.syncPublisher(SettingsListener.TOPIC).settingsUpdated(settings.continueState)
    }

    override fun reset() {
        val settings = ContinueExtensionSettings.instance
        mySettingsComponent?.remoteConfigServerUrl?.text = settings.continueState.remoteConfigServerUrl
        mySettingsComponent?.remoteConfigSyncPeriod?.text = settings.continueState.remoteConfigSyncPeriod.toString()
        mySettingsComponent?.userToken?.text = settings.continueState.userToken
        mySettingsComponent?.enableTabAutocomplete?.isSelected = settings.continueState.enableTabAutocomplete
    }

    override fun disposeUIResources() {
        mySettingsComponent = null
    }

    override fun getDisplayName(): String {
        return "Continue Extension Settings"
    }
}
