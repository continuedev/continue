package com.github.continuedev.continueintellijextension.services

import com.github.continuedev.continueintellijextension.constants.getConfigJsonPath
import com.github.continuedev.continueintellijextension.error.ContinueSentryService
import com.intellij.openapi.application.ApplicationInfo
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
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
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
    val enableOSR: JCheckBox = JCheckBox("Enable Off-Screen Rendering")
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
        panel.add(enableOSR, constraints)
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
        var enableOSR: Boolean = shouldRenderOffScreen()
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
                val responseBody = HttpRequests.post(url, HttpRequests.JSON_CONTENT_TYPE)
                    .tuner { connection ->
                        if (token != null)
                            connection.addRequestProperty("Authorization", "Bearer $token")
                    }.readString()
                val response = Json.decodeFromString<ContinueRemoteConfigSyncResponse>(responseBody)
                val file = File(getConfigJsonPath(URL(url).host))
                response.configJs.let { file.writeText(it!!) }
                response.configJson.let { file.writeText(it!!) }
            } catch (e: IOException) {
                service<ContinueSentryService>().report(e, "Unexpected exception during remote config sync")
            }
        }
    }

    // Create a scheduled task to sync remote config every `remoteConfigSyncPeriod` minutes
    fun addRemoteSyncJob() {

        if (remoteSyncFuture != null) {
            remoteSyncFuture?.cancel(false)
        }

        instance.remoteSyncFuture = AppExecutorUtil.getAppScheduledExecutorService()
            .scheduleWithFixedDelay(
                ::syncRemoteConfig,
                0,
                continueState.remoteConfigSyncPeriod.toLong(),
                TimeUnit.MINUTES
            )
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
                    mySettingsComponent?.enableOSR?.isSelected != settings.continueState.enableOSR ||
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
        settings.continueState.enableOSR = mySettingsComponent?.enableOSR?.isSelected ?: true
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
        mySettingsComponent?.enableOSR?.isSelected = settings.continueState.enableOSR
        mySettingsComponent?.displayEditorTooltip?.isSelected = settings.continueState.displayEditorTooltip
        mySettingsComponent?.showIDECompletionSideBySide?.isSelected =
            settings.continueState.showIDECompletionSideBySide

        ContinueExtensionSettings.instance.addRemoteSyncJob()
    }

    override fun disposeUIResources() {
        mySettingsComponent = null
    }

    override fun getDisplayName(): String {
        return "Continue Extension Settings"
    }
}

/**
 * This function checks if off-screen rendering (OSR) should be used.
 *
 * If ui.useOSR is set in config.json, that value is used.
 *
 * Otherwise, we check if the pluginSinceBuild is greater than or equal to 233, which corresponds
 * to IntelliJ platform version 2023.3 and later.
 *
 * Setting `setOffScreenRendering` to `false` causes a number of issues such as a white screen flash when loading
 * the GUI and the inability to set `cursor: pointer`. However, setting `setOffScreenRendering` to `true` on
 * platform versions prior to 2023.3.4 causes larger issues such as an inability to type input for certain languages,
 * e.g. Korean.
 *
 * References:
 * 1. https://youtrack.jetbrains.com/issue/IDEA-347828/JCEF-white-flash-when-tool-window-show#focus=Comments-27-9334070.0-0
 *    This issue mentions that white screen flash problems were resolved in platformVersion 2023.3.4.
 * 2. https://www.jetbrains.com/idea/download/other.html
 *    This documentation shows mappings from platformVersion to branchNumber.
 *
 * We use the branchNumber (e.g., 233) instead of the full version number (e.g., 2023.3.4) because
 * it's a simple integer without dot notation, making it easier to compare.
 */
private fun shouldRenderOffScreen(): Boolean {
    val minBuildNumber = 233
    val applicationInfo = ApplicationInfo.getInstance()
    val currentBuildNumber = applicationInfo.build.baselineVersion
    return currentBuildNumber >= minBuildNumber
}