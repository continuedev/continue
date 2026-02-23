package com.github.continuedev.continueintellijextension.services

import com.github.continuedev.continueintellijextension.constants.getConfigJsonPath
import com.github.continuedev.continueintellijextension.constants.getConfigJsPath
import com.github.continuedev.continueintellijextension.error.ContinueSentryService
import com.google.gson.Gson
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.openapi.components.service
import com.intellij.openapi.options.Configurable
import com.intellij.openapi.project.DumbAware
import com.intellij.util.concurrency.AppExecutorUtil
import com.intellij.util.io.HttpRequests
import com.intellij.util.messages.Topic
import java.awt.GridBagConstraints
import java.awt.GridBagLayout
import java.io.File
import java.io.IOException
import java.net.URL
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
import javax.swing.*

class ContinueSettingsComponent : DumbAware {
    val panel: JPanel = JPanel(GridBagLayout())
    val remoteConfigServerUrl: JTextField = JTextField()
    val remoteConfigSyncPeriod: JTextField = JTextField()
    val userToken: JTextField = JTextField()
    val enableTabAutocomplete: JCheckBox = JCheckBox("Enable Tab Autocomplete")
    val displayEditorTooltip: JCheckBox = JCheckBox("Display Editor Tooltip")
    val showIDECompletionSideBySide: JCheckBox = JCheckBox("Show IDE completions side-by-side")

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
        panel.add(displayEditorTooltip, constraints)
        constraints.gridy++
        panel.add(showIDECompletionSideBySide, constraints)
        constraints.gridy++

        // Add a "filler" component that takes up all remaining vertical space
        constraints.weighty = 1.0
        val filler = JPanel()
        panel.add(filler, constraints)
    }
}

data class ContinueRemoteConfigSyncResponse(
    var configJson: String?,
    var configJs: String?
)

@State(
    name = "com.github.continuedev.continueintellijextension.services.ContinueExtensionSettings",
    storages = [Storage("ContinueExtensionSettings.xml")]
)
open class ContinueExtensionSettings : PersistentStateComponent<ContinueExtensionSettings.ContinueState> {

    class ContinueState {
        var lastSelectedInlineEditModel: String? = null
        var shownWelcomeDialog: Boolean = false
        var remoteConfigServerUrl: String? = null
        var remoteConfigSyncPeriod: Int = 60
        var userToken: String? = null
        var enableTabAutocomplete: Boolean = true
        var displayEditorTooltip: Boolean = true
        var showIDECompletionSideBySide: Boolean = false
        var continueTestEnvironment: String = "production"
    }

    var continueState: ContinueState = ContinueState()

    private var remoteSyncFuture: ScheduledFuture<*>? = null

    override fun getState(): ContinueState {
        return continueState
    }

    override fun loadState(state: ContinueState) {
        continueState = state
    }

    companion object {
        val instance: ContinueExtensionSettings
            get() = service<ContinueExtensionSettings>()
    }


    // Sync remote config from server
    private fun syncRemoteConfig() {
        val remoteServerUrl = state.remoteConfigServerUrl
        val token = state.userToken
        if (remoteServerUrl != null && remoteServerUrl.isNotEmpty()) {
            val baseUrl = remoteServerUrl.removeSuffix("/")
            try {
                val url = "$baseUrl/sync"
                val responseBody = HttpRequests.request(url)
                    .tuner { connection ->
                        if (token != null)
                            connection.addRequestProperty("Authorization", "Bearer $token")
                    }.readString()
                val response = Gson().fromJson(responseBody, ContinueRemoteConfigSyncResponse::class.java)
                val hostname = URL(url).host
                
                // Write configJson to config.json if present
                if (!response.configJson.isNullOrEmpty()) {
                    File(getConfigJsonPath(hostname)).writeText(response.configJson!!)
                }
                
                // Write configJs to config.js if present
                if (!response.configJs.isNullOrEmpty()) {
                    File(getConfigJsPath(hostname)).writeText(response.configJs!!)
                }
            } catch (e: Exception) {
                // Catch all exceptions including JsonSyntaxException
                service<ContinueSentryService>().report(e, "Unexpected exception during remote config sync")
            }
        }
    }

    // Create a scheduled task to sync remote config every `remoteConfigSyncPeriod` minutes
    fun addRemoteSyncJob() {
        // Cancel existing job if present
        if (remoteSyncFuture != null) {
            remoteSyncFuture?.cancel(false)
            remoteSyncFuture = null
        }

        // Only schedule sync job if remote config server URL is configured
        val remoteServerUrl = continueState.remoteConfigServerUrl
        if (remoteServerUrl != null && remoteServerUrl.isNotEmpty()) {
            instance.remoteSyncFuture = AppExecutorUtil.getAppScheduledExecutorService()
                .scheduleWithFixedDelay(
                    ::syncRemoteConfig,
                    0,
                    continueState.remoteConfigSyncPeriod.toLong(),
                    TimeUnit.MINUTES
                )
        }
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
        val modified =
            mySettingsComponent?.remoteConfigServerUrl?.text != settings.continueState.remoteConfigServerUrl ||
                    mySettingsComponent?.remoteConfigSyncPeriod?.text?.toInt() != settings.continueState.remoteConfigSyncPeriod ||
                    mySettingsComponent?.userToken?.text != settings.continueState.userToken ||
                    mySettingsComponent?.enableTabAutocomplete?.isSelected != settings.continueState.enableTabAutocomplete ||
                    mySettingsComponent?.displayEditorTooltip?.isSelected != settings.continueState.displayEditorTooltip ||
                    mySettingsComponent?.showIDECompletionSideBySide?.isSelected != settings.continueState.showIDECompletionSideBySide
        return modified
    }

    override fun apply() {
        val settings = ContinueExtensionSettings.instance
        settings.continueState.remoteConfigServerUrl = mySettingsComponent?.remoteConfigServerUrl?.text
        settings.continueState.remoteConfigSyncPeriod = mySettingsComponent?.remoteConfigSyncPeriod?.text?.toInt() ?: 60
        settings.continueState.userToken = mySettingsComponent?.userToken?.text
        settings.continueState.enableTabAutocomplete = mySettingsComponent?.enableTabAutocomplete?.isSelected ?: false
        settings.continueState.displayEditorTooltip = mySettingsComponent?.displayEditorTooltip?.isSelected ?: true
        settings.continueState.showIDECompletionSideBySide =
            mySettingsComponent?.showIDECompletionSideBySide?.isSelected ?: false

        ApplicationManager.getApplication().messageBus.syncPublisher(SettingsListener.TOPIC)
            .settingsUpdated(settings.continueState)
        ContinueExtensionSettings.instance.addRemoteSyncJob()
    }

    override fun reset() {
        val settings = ContinueExtensionSettings.instance
        mySettingsComponent?.remoteConfigServerUrl?.text = settings.continueState.remoteConfigServerUrl
        mySettingsComponent?.remoteConfigSyncPeriod?.text = settings.continueState.remoteConfigSyncPeriod.toString()
        mySettingsComponent?.userToken?.text = settings.continueState.userToken
        mySettingsComponent?.enableTabAutocomplete?.isSelected = settings.continueState.enableTabAutocomplete
        mySettingsComponent?.displayEditorTooltip?.isSelected = settings.continueState.displayEditorTooltip
        mySettingsComponent?.showIDECompletionSideBySide?.isSelected =
            settings.continueState.showIDECompletionSideBySide

        ContinueExtensionSettings.instance.addRemoteSyncJob()
    }

    override fun disposeUIResources() {
        mySettingsComponent = null
    }

    override fun getDisplayName(): String =
        "Continue Extension Settings"
}
